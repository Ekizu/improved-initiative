import * as React from "react";
import { Listable } from "../../../common/Listable";
import { useSubscription } from "../../Combatant/linkComponentToObservables";
import { Listing } from "../Listing";
import { SelectionContext, Selection } from "./SelectionContext";

export function LibraryManagerRow(props: {
  listing: Listing<any>;
  defaultListing: Listable;
  setEditorTarget: (item: Listable) => void;
}) {
  const listingMeta = useSubscription(props.listing.Meta);
  const selection = React.useContext<Selection<Listing<any>>>(SelectionContext);
  const isSelected = selection.selected.includes(props.listing);
  return (
    <div
      style={{
        backgroundColor: isSelected ? "red" : undefined,
        userSelect: "none",
        display: "flex",
        flexFlow: "row",
        justifyContent: "space-between"
      }}
      onClick={mouseEvent => {
        if (mouseEvent.ctrlKey || mouseEvent.metaKey) {
          selection.addSelected(props.listing);
        } else {
          selection.setSelected(props.listing);
        }
      }}
    >
      <span>{listingMeta.Name}</span>
      <span
        onClick={async e => {
          e.stopPropagation();
          const item = await props.listing.GetWithTemplate(
            props.defaultListing
          );
          props.setEditorTarget(item);
        }}
      >
        edit
      </span>
    </div>
  );
}
