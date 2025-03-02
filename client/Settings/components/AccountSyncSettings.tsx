import { saveAs } from "browser-filesaver";
import { forIn } from "lodash";
import * as React from "react";

import * as _ from "lodash";

import { Listable } from "../../../common/Listable";
import { AccountClient } from "../../Account/AccountClient";
import { linkComponentToObservables } from "../../Combatant/linkComponentToObservables";
import { Button } from "../../Components/Button";
import { UpdateLegacySavedEncounter } from "../../Encounter/UpdateLegacySavedEncounter";
import { env } from "../../Environment";
import { Libraries } from "../../Library/Libraries";
import { Listing } from "../../Library/Listing";
import { LegacySynchronousLocalStore } from "../../Utility/LegacySynchronousLocalStore";
import { Store } from "../../Utility/Store";

interface AccountSyncSettingsProps {
  libraries: Libraries;
  accountClient: AccountClient;
}

interface AccountSyncSettingsState {
  syncError: string;
}

export class AccountSyncSettings extends React.Component<
  AccountSyncSettingsProps,
  AccountSyncSettingsState
> {
  constructor(props) {
    super(props);
    this.state = {
      syncError: ""
    };
    linkComponentToObservables(this);
  }
  public render() {
    if (!env.IsLoggedIn) {
      return this.loginMessage();
    }

    if (!env.HasStorage) {
      return this.noSyncMessage();
    }

    return (
      <>
        <h3>Account Sync</h3>
        <p>Account Sync is enabled.</p>
        <div className="sync-counts">
          {this.syncCount(
            "Statblocks",
            this.getCounts(this.props.libraries.StatBlocks.GetAllListings())
          )}
          {this.syncCount(
            "Characters",
            this.getCounts(
              this.props.libraries.PersistentCharacters.GetAllListings()
            )
          )}
          {this.syncCount(
            "Spells",
            this.getCounts(this.props.libraries.Spells.GetAllListings())
          )}
          {this.syncCount(
            "Encounters",
            this.getCounts(this.props.libraries.Encounters.GetAllListings())
          )}
        </div>
        <div className="c-button-with-label">
          <span>Backup and sync local data</span>
          <Button fontAwesomeIcon="cloud-upload-alt" onClick={this.syncAll} />
        </div>
        {this.state.syncError && <pre>{this.state.syncError}</pre>}
        <div className="c-button-with-label">
          <span>Download all synced data to local data</span>
          <Button
            fontAwesomeIcon="cloud-download-alt"
            onClick={this.downloadAndSaveAllSyncedItems}
          />
        </div>
        <div className="c-button-with-label">
          <span>Delete all synced account data</span>
          <Button fontAwesomeIcon="trash" onClick={this.deleteAccount} />
        </div>
        <a className="button logout" href="/logout">
          Log Out
        </a>
      </>
    );
  }

  private loginMessage() {
    return (
      <>
        <p>
          Log in with Patreon to access patron benefits. Account Sync allows you
          to access your custom statblocks and encounters from anywhere!
        </p>
        <a className="login button" href={env.PatreonLoginUrl}>
          Log In with Patreon
        </a>
      </>
    );
  }

  private noSyncMessage() {
    return (
      <>
        <p>
          {"You're logged in with Patreon, but you have not selected the "}
          <a
            href="https://www.patreon.com/bePatron?c=716070&rid=1322253"
            target="_blank"
          >
            Account Sync
          </a>
          {
            " reward level. If you have recently updated your pledge, try logging out and back in again to propagate your rewards."
          }
        </p>
        <a className="button logout" href="/logout">
          Log Out
        </a>
      </>
    );
  }

  private syncCount = (libraryName: string, syncCount: string) => (
    <span className="sync-counts__row">
      <span className="sync-counts__library-name">{libraryName}</span>
      <span className="sync-counts__count">{syncCount}</span>
    </span>
  );

  private syncAll = async () => {
    this.setState({ syncError: "" });
    const asyncKeys = await Store.GetAllKeyPairs();
    const blob = LegacySynchronousLocalStore.ExportAll(asyncKeys);
    saveAs(blob, "improved-initiative.json");
    this.props.accountClient.SaveAllUnsyncedItems(
      this.props.libraries,
      progressMessage => {
        this.setState({
          syncError:
            this.state.syncError + "\n" + JSON.stringify(progressMessage)
        });
      }
    );
  };

  private downloadAndSaveAllSyncedItems = async () => {
    const account = await this.props.accountClient.GetFullAccount();
    if (!account) {
      console.warn("No account from GetFullAccount");
      return;
    }

    const librariesStores = [
      [account.statblocks, Store.StatBlocks],
      [account.spells, Store.Spells],
      [account.persistentcharacters, Store.PersistentCharacters],
      [account.encounters, Store.SavedEncounters]
    ] as const;

    for (const [library, store] of librariesStores) {
      await Promise.all(
        Object.keys(library ?? {}).map(async itemId => {
          try {
            const item = library[itemId];
            return await Store.Save(store, itemId, item);
          } catch (e) {
            console.error(JSON.stringify(e));
          }
        })
      );
    }

    location.reload();
  };

  private deleteAccount = async () => {
    const promptText =
      "To delete all of the user data synced to your account, enter DELETE.";
    if (prompt(promptText) == "DELETE") {
      try {
        await this.props.accountClient.DeleteAccount();
      } catch {}
      location.href = env.BaseUrl + "/logout";
    }
  };

  private getCounts<T extends Listable>(items: Listing<T>[]) {
    const localCount = _.uniqBy(
      items.filter(
        c => c.Origin === "localAsync" || c.Origin === "localStorage"
      ),
      i => [i.Meta().Path, i.Meta().Name].toString()
    ).length;
    const accountCount = items.filter(c => c.Origin === "account").length;
    return `${localCount} local, ${accountCount} synced`;
  }
}
