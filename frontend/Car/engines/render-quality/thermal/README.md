# thermal — surchauffe (lot 3)

Estime la chauffe (dérive du temps de frame à charge égale, chutes de FPS répétées, Battery API si elle existe)
en un score de 0 à 3 : normal, tiède, chaud, critique. Chaque palier réduit les budgets ; retour au palier
inférieur après 30 secondes stables. Le réglage manuel reste prioritaire, sauf au palier critique.
