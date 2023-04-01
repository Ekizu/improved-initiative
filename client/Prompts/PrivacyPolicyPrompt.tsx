import * as React from "react";
import { LegacySynchronousLocalStore } from "../Utility/LegacySynchronousLocalStore";
import { Metrics } from "../Utility/Metrics";
import { PromptProps } from "./PendingPrompts";
import { SubmitButton } from "../Components/Button";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";

const privacyPolicyText: string = require("../../PRIVACY.md").default;

const promptClassName = "p-privacy-policy";

function PrivacyPolicyComponent() {
  const [displayFullText, setDisplayFullText] = React.useState(false);
  const privacyBrief =
    "Improved Initiative has a privacy policy. Your data is never sold to third parties. You can help improve the app by sharing your usage data.";
  const moreInfoButton = (
    <a href="#" onClick={e => setDisplayFullText(true)}>
      More Info.
    </a>
  );

  const noThanksButton = (
    <SubmitButton
      additionalClassNames={promptClassName + "-nothanks"}
      fontAwesomeIcon=""
      text="No Thanks"
      submitIntent={["optIn", false]}
    />
  );

  const optInButton = (
    <SubmitButton
      additionalClassNames={promptClassName + "-optin"}
      fontAwesomeIcon=""
      text="Opt In"
      submitIntent={["optIn", true]}
    />
  );

  return (
    <div className={promptClassName}>
      <p>
        {privacyBrief} {moreInfoButton}
      </p>
      {displayFullText && (
        <ReactMarkdown className={promptClassName + "-full"}>
          {privacyPolicyText}
        </ReactMarkdown>
      )}
      <div className={promptClassName + "-buttons"}>
        {noThanksButton}
        {optInButton}
      </div>
    </div>
  );
}

export function PrivacyPolicyPrompt(): PromptProps<{ optIn: boolean }> {
  return {
    autoFocusSelector: "." + promptClassName + "-optin",
    children: <PrivacyPolicyComponent />,
    initialValues: { optIn: false },
    onSubmit: model => {
      if (model.optIn) {
        LegacySynchronousLocalStore.Save(
          LegacySynchronousLocalStore.User,
          "AllowTracking",
          true
        );
        Metrics.TrackLoad();
      } else {
        LegacySynchronousLocalStore.Save(
          LegacySynchronousLocalStore.User,
          "AllowTracking",
          false
        );
      }
      return true;
    }
  };
}
