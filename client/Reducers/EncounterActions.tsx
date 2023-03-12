import { CombatantState } from "../../common/CombatantState";
import { StatBlock } from "../../common/StatBlock";

export type EncounterAction =
  | AddCombatantFromState
  | AddCombatantFromStatBlock
  | RemoveCombatant
  | StartEncounter
  | EndEncounter
  | NextTurn
  | PreviousTurn
  | ClearEncounter
  | CleanEncounter
  | RestoreAllPlayerCharacterHP;

type AddCombatantFromState = {
  type: "AddCombatantFromState";
  payload: {
    combatantState: CombatantState;
  };
};

type AddCombatantFromStatBlock = {
  type: "AddCombatantFromStatBlock";
  payload: {
    combatantId: string;
    statBlock: StatBlock;
    rolledHP?: number;
  };
};

type RemoveCombatant = {
  type: "RemoveCombatant";
  payload: {
    combatantId: string;
  };
};

type StartEncounter = {
  type: "StartEncounter";
  payload: {
    initiativesByCombatantId: Record<string, number>;
  };
};

type EndEncounter = {
  type: "EndEncounter";
};

type NextTurn = {
  type: "NextTurn";
};

type PreviousTurn = {
  type: "PreviousTurn";
};

type ClearEncounter = {
  type: "ClearEncounter";
};

type CleanEncounter = {
  type: "CleanEncounter";
};

type RestoreAllPlayerCharacterHP = {
  type: "RestoreAllPlayerCharacterHP";
};

/* 
    TODO:
    >EncounterActions
    ApplyInitiativesAndResetRound (for round-to-round encounter reroll)
*/
