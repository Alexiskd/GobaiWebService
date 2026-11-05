// Notes d'information : repliées sur mobile pour laisser la place au formulaire.
export function ContributionNotes({ compact }) {
  const notes = (
    <>
      <p className="contribution-note">
        Import LAZ uniquement. Les contributions et commentaires apparaissent sous votre pseudo ; les fichiers restent dans le stockage pair-à-pair.
      </p>
      <p className="contribution-note">Le compte par jeton de connexion sera ajouté ultérieurement.</p>
      <p className="contribution-note">Tiering : pseudo et index dans localStorage, gros blocs dans le Cache du navigateur, petits blocs dans IndexedDB. Aucun cookie.</p>
    </>
  );

  return compact ? (
    <details className="contribution-notes">
      <summary>ⓘ Comment ça marche</summary>
      {notes}
    </details>
  ) : notes;
}
