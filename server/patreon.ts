import * as crypto from "crypto";

import * as express from "express";

import * as _ from "lodash";
import * as patreon from "patreon";

import * as request from "request";

import * as DB from "./dbconnection";

import { ParseJSONOrDefault } from "../common/Toolbox";
import thanks from "../thanks";
import { AccountStatus } from "./user";

type Req = Express.Request & express.Request & { rawBody: string };
type Res = Express.Response & express.Response;

const tiersWithAccountSyncEntitled = [
  "1322253", // deprecated: "Improved Initiative"
  "8750629", // "Account Sync"
  "1937132", // deprecated: "Epic Initiative"
  "8749940" // "Epic Tier"
];

const tiersWithEpicEntitled = ["1937132", "8749940"];

const baseUrl = process.env.BASE_URL,
  patreonClientId = process.env.PATREON_CLIENT_ID,
  patreonClientSecret = process.env.PATREON_CLIENT_SECRET,
  patreonUrl = process.env.PATREON_URL;

interface Post {
  attributes: {
    title: string;
    url: string;
    was_posted_by_campaign_owner: boolean;
    //content: string;
    //created_at: string;
  };
  //id: string;
  //type: string;
}

interface Pledge {
  id: string;
  type: "pledge";
  relationships: {
    reward: { data: { id: string } };
  };
}

type PatreonCampaign = {
  data: Post[];
};

export function configureLoginRedirect(app: express.Application): void {
  const redirectPath = "/r/patreon";
  const redirectUri = baseUrl + redirectPath;

  app.get(redirectPath, async (req: Req, res: Res) => {
    try {
      console.log("req.query >" + JSON.stringify(req.query));
      console.log("req.body >" + JSON.stringify(req.body));
      const code = req.query.code;

      const OAuthClient = patreon.oauth(patreonClientId, patreonClientSecret);

      const tokens = await OAuthClient.getTokens(code, redirectUri);

      const APIClient = patreon.patreon(tokens.access_token);
      const { rawJson } = await APIClient(`/current_user`);
      await handleCurrentUser(req, res, rawJson);
    } catch (err) {
      console.error("Patreon login flow failed:", JSON.stringify(err));
      res
        .status(500)
        .send(
          "There was a problem logging in via Patreon. This is probably a temporary issue with Patreon; please try again later."
        );
    }
  });
}

export async function handleCurrentUser(
  req: Req,
  res: Res,
  apiResponse: Record<string, any>
): Promise<void> {
  //console.log(`api response: ${JSON.stringify(apiResponse)}`);
  let encounterId = "";
  if (req.query && req.query.state) {
    encounterId = (req.query.state as string).replace(/['"]/g, "");
  }

  const pledges = (apiResponse.included || []).filter(
    item => item.type == "pledge" && item.attributes.declined_since == null
  );

  const userRewards = pledges.map((r: Pledge) =>
    _.get(r, "relationships.reward.data.id", "none")
  );

  const userId = apiResponse.data.id;
  const standing = getUserAccountLevel(userId, userRewards);
  const emailAddress = _.get(apiResponse, "data.attributes.email", "");

  const session = req.session;

  if (session === undefined) {
    throw "Session is undefined";
  }
  updateSessionAccountFeatures(session, standing);

  const user = await DB.upsertUser(apiResponse.data.id, standing, emailAddress);
  if (!user) {
    throw "Failed to insert user into database";
  }
  session.userId = user._id;
  res.redirect(`/e/${encounterId}?login=patreon`);
}

export function updateSessionAccountFeatures(
  session: Express.Session,
  standing: AccountStatus
): void {
  session.hasStorage = standing == "pledge" || standing == "epic";
  session.hasEpicInitiative = standing == "epic";
  session.isLoggedIn = true;
}

function getUserAccountLevel(
  userId: string,
  rewardIds: string[]
): AccountStatus {
  const hasStorageReward =
    _.intersection(rewardIds, tiersWithAccountSyncEntitled).length > 0;

  const hasEpicInitiativeThanks = _.includes(
    thanks.map(t => t.PatreonId),
    userId
  );
  const hasEpicInitiativeReward =
    _.intersection(rewardIds, tiersWithEpicEntitled).length > 0;

  const hasEpicInitiative = hasEpicInitiativeThanks || hasEpicInitiativeReward;

  const standing = hasEpicInitiative
    ? AccountStatus.Epic
    : hasStorageReward
    ? AccountStatus.Pledge
    : AccountStatus.None;

  return standing;
}

export function configureLogout(app: express.Application): void {
  const logoutPath = "/logout";
  app.get(logoutPath, (req: Req, res: Res) => {
    if (req.session == null) {
      throw "Session is not available";
    }

    req.session.destroy(err => {
      if (err) {
        console.error(err);
      }

      if (baseUrl == null) {
        throw "Base URL is not configured.";
      }

      return res.redirect(baseUrl);
    });
  });
}

function updateLatestPost(latestPost: { post: Post | null }) {
  if (patreonUrl == null) {
    throw "Patreon URL is not configured.";
  }

  request.get(patreonUrl, (error, response, body) => {
    const json = ParseJSONOrDefault<PatreonCampaign>(body, { data: [] });
    if (json.data?.length) {
      latestPost.post = json.data.filter(
        d => d.attributes.was_posted_by_campaign_owner
      )[0];
    }
  });
}

export function startNewsUpdates(app: express.Application): void {
  const latest: { post: Post | null } = { post: null };

  app.get("/whatsnew/", (req, res) => {
    const post: Post = latest.post || {
      attributes: {
        title: process.env.FALLBACK_POST_TITLE || "Pledge on Patreon",
        url:
          process.env.FALLBACK_POST_URL ||
          "https://www.patreon.com/improvedinitiative",
        was_posted_by_campaign_owner: true
      }
    };
    res.json(post);
  });

  if (!patreonUrl) {
    return;
  }

  updateLatestPost(latest);

  app.get("/updatenews/", (req: Req, res: Res) => {
    updateLatestPost(latest);
    res.sendStatus(200);
  });
}

export function configurePatreonWebhookReceiver(
  app: express.Application
): void {
  app.post("/patreon_webhook/", verifySender, handleWebhook);
}

async function handleWebhook(req: Req, res: Res) {
  try {
    const userId = _.get(req.body, "data.relationships.user.data.id", null);

    if (!userId) {
      return res.status(400).send("Missing data.relationships.user.data.id");
    }

    const entitledTiers: { id: string }[] | null = _.get(
      req.body,
      "data.relationships.currently_entitled_tiers.data",
      null
    );

    if (!entitledTiers) {
      return res
        .status(400)
        .send("Missing data.relationships.currently_entitled_tiers.data");
    }

    const userEmail = _.get(req.body, "data.attributes.email", "");

    const isDeletedPledge =
      req.header("X-Patreon-Event") == "members:pledge:delete";

    const userAccountLevel = isDeletedPledge
      ? AccountStatus.None
      : getUserAccountLevel(
          userId,
          entitledTiers.map(tier => tier.id)
        );
    console.log(
      `Updating account level for ${userEmail} to ${userAccountLevel}`
    );
    await DB.upsertUser(userId, userAccountLevel, userEmail);
    return res.send(201);
  } catch (e) {
    return res.status(500).send(e);
  }
}

function verifySender(req: Req, res: Res, next) {
  console.log(req.rawBody);

  const webhookSecret = process.env.PATREON_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(501).send("Webhook not configured");
  }

  const signature = req.header("X-Patreon-Signature");
  if (!signature) {
    console.log("Signature not found.");
    return res.status(401).send("Signature not found.");
  }

  if (!verifySignature(signature, webhookSecret, req.rawBody)) {
    console.log("Signature mismatch with provided signature: " + signature);
    return res.status(401).send("Signature mismatch.");
  }

  return next();
}

function verifySignature(
  signature: string,
  secret: string,
  postBodyJSON: string
): boolean {
  const hmac = crypto.createHmac("md5", secret);

  hmac.update(postBodyJSON);

  const crypted = hmac.digest("hex");

  return crypted === signature;
}
