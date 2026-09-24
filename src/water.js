export function createWater({
  flow = 0,
  turbidity = 0,
  pH = 7,
  temperature = 15,
  // mg/L en CaCO3 : pouvoir tampon, c'est lui qui retient le pH. 120 est une
  // eau de surface ordinaire. La valeur n'est pas un détail de décor : c'est
  // elle qui fixe la largeur de la fenêtre de réglage de la chaux, parce que le
  // pH d'une eau peu tamponnée bascule d'une unité pour un demi-milligramme.
  alkalinity = 120,
  toc = 4, // mg/L de carbone organique total : précurseur des sous-produits chlorés
  // mg/L en CaCO3. Avec l'alcalinité, le calcium décide si l'eau attaque le
  // réseau. Dureté à peu près égale à l'alcalinité : la dureté est ici
  // essentiellement carbonatée, le cas courant.
  calcium = 120,
  // µg/L : présent naturellement dans l'eau brute, inoffensif tel quel. C'est
  // l'ozone qui l'oxyde en bromate, lui cancérogène et réglementé.
  bromide = 60,
  bromate = 0, // µg/L : une fois formé, plus rien en aval ne l'enlève
  // Réactivité du COT vis-à-vis du chlore, de 1 (organique brut, aromatique,
  // très réactif) vers le bas. Quantité et réactivité sont deux choses
  // distinctes : l'ozone ne minéralise presque pas le COT mais casse les
  // structures aromatiques qui font les THM.
  precursorFraction = 1,
  // Part de l'inactivation réglementaire déjà acquise en amont de la
  // chloration, de 0 à 1. L'inactivation s'accumule le long de la filière :
  // ce qu'un désinfectant a déjà tué, le suivant n'a plus à le tuer. C'est
  // ainsi que se tient vraiment la comptabilité du CT dans une usine.
  disinfectionCredit = 0,
  ozoneResidual = 0,
  chlorineResidual = 0,
} = {}) {
  return {
    flow,
    turbidity,
    pH,
    temperature,
    alkalinity,
    toc,
    calcium,
    bromide,
    bromate,
    precursorFraction,
    disinfectionCredit,
    ozoneResidual,
    chlorineResidual,
  };
}

export function cloneWater(water) {
  return { ...water };
}
