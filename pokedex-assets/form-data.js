// Non-battle forms from Bulbapedia's Pokemon GO form-differences list.
// `existing` names seed rows after the species row, in their original order.
// `add` creates distinct cards without changing any existing card IDs.
window.POKEDEX_FORM_CATALOG = [
  { dex: 128, existing: ["Paldean Combat Breed", "Paldean Blaze Breed", "Paldean Aqua Breed"] },
  { dex: 150, existing: [{ name: "Armored", sprite: "mewtwo-armored" }] },
  { dex: 201, add: [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "!", "?"] },
  { dex: 327, add: Array.from({ length: 20 }, (_, index) => ({ name: `Pattern ${index + 1}`, unreleased: index >= 9 })) },
  { dex: 351, existing: ["Sunny", "Rainy", "Snowy"] },
  { dex: 386, existing: ["Attack Forme", "Defense Forme", "Speed Forme"] },
  { dex: 412, add: ["Plant Cloak", "Sandy Cloak", "Trash Cloak"] },
  { dex: 413, add: [
    { name: "Plant Cloak", types: ["Bug", "Grass"] },
    { name: "Sandy Cloak", types: ["Bug", "Ground"] },
    { name: "Trash Cloak", types: ["Bug", "Steel"] }
  ] },
  { dex: 421, add: ["Overcast Form", "Sunshine Form"] },
  { dex: 422, add: ["West Sea", "East Sea"] },
  { dex: 423, add: ["West Sea", "East Sea"] },
  { dex: 479, existing: ["Heat", "Wash", "Frost", "Fan", "Mow"] },
  { dex: 483, existing: ["Origin Forme"] },
  { dex: 484, existing: ["Origin Forme"] },
  { dex: 487, existing: ["Origin Forme"] },
  { dex: 492, existing: ["Sky Forme"] },
  { dex: 550, add: ["Red-Striped Form", "Blue-Striped Form", "White-Striped Form"] },
  { dex: 585, add: ["Spring Form", "Summer Form", "Autumn Form", "Winter Form"] },
  { dex: 586, add: ["Spring Form", "Summer Form", "Autumn Form", "Winter Form"] },
  { dex: 641, existing: ["Therian Forme"] },
  { dex: 642, existing: ["Therian Forme"] },
  { dex: 645, existing: ["Therian Forme"] },
  { dex: 647, add: ["Ordinary Form", "Resolute Form"] },
  { dex: 649, add: ["No Drive", "Shock Drive", "Burn Drive", "Chill Drive", "Douse Drive"] },
  { dex: 666, add: [
    "Archipelago", "Continental", "Elegant", "Garden", "High Plains", "Icy Snow",
    "Jungle", "Marine", "Meadow", "Modern", "Monsoon", "Ocean", "Polar", "River",
    "Sandstorm", "Savanna", "Sun", "Tundra"
  ].map(pattern => `${pattern} Pattern`) },
  { dex: 669, add: ["Red Flower", "Blue Flower", "Yellow Flower", "White Flower", "Orange Flower"] },
  { dex: 670, add: ["Red Flower", "Blue Flower", "Yellow Flower", "White Flower", "Orange Flower"] },
  { dex: 671, add: ["Red Flower", "Blue Flower", "Yellow Flower", "White Flower", "Orange Flower"] },
  { dex: 676, add: [
    "Natural Form", "Matron Trim", "Dandy Trim", "Debutante Trim", "Diamond Trim",
    "Star Trim", "La Reine Trim", "Kabuki Trim", "Pharaoh Trim", "Heart Trim"
  ] },
  { dex: 678, add: ["Male", "Female"] },
  { dex: 710, existing: ["Small Variety", "Large Variety", "Jumbo Variety"] },
  { dex: 711, existing: ["Small Variety", "Large Variety", "Jumbo Variety"] },
  { dex: 718, existing: [
    { name: "50% Forme", sprite: "zygarde-50" },
    { name: "Complete Forme", sprite: "zygarde-complete" }
  ] },
  { dex: 720, existing: ["Unbound"] },
  { dex: 741, add: [
    { name: "Baile Style", types: ["Fire", "Flying"] },
    { name: "Pom-Pom Style", types: ["Electric", "Flying"] },
    { name: "Pa'u Style", types: ["Psychic", "Flying"] },
    { name: "Sensu Style", types: ["Ghost", "Flying"] }
  ] },
  { dex: 745, existing: ["Midnight Form", "Dusk Form"] },
  { dex: 849, add: ["Amped Form", "Low Key Form"] },
  { dex: 854, add: ["Phony Form", "Antique Form"] },
  { dex: 855, add: ["Phony Form", "Antique Form"] },
  { dex: 888, add: [{ name: "Crowned Sword", types: ["Fairy", "Steel"] }] },
  { dex: 889, add: [{ name: "Crowned Shield", types: ["Fighting", "Steel"] }] },
  { dex: 892, types: ["Fighting", "Dark"], add: [
    { name: "Single Strike Style", types: ["Fighting", "Dark"] },
    { name: "Rapid Strike Style", types: ["Fighting", "Water"] }
  ] },
  { dex: 905, add: ["Therian Forme"] },
  { dex: 916, existing: ["Female"] },
  { dex: 925, add: ["Family of Four", "Family of Three"] },
  { dex: 931, types: ["Normal", "Flying"], add: [
    { name: "Green Plumage", types: ["Normal", "Flying"] },
    { name: "Blue Plumage", types: ["Normal", "Flying"] },
    { name: "Yellow Plumage", types: ["Normal", "Flying"] },
    { name: "White Plumage", types: ["Normal", "Flying"] }
  ] },
  { dex: 978, types: ["Dragon", "Water"], add: ["Curly Form", "Droopy Form", "Stretchy Form"] },
  { dex: 982, types: ["Normal", ""], add: ["Two-Segment Form", "Three-Segment Form"] },
  { dex: 1012, types: ["Grass", "Ghost"], add: ["Counterfeit Form", "Artisan Form"] },
  { dex: 1013, types: ["Grass", "Ghost"], add: ["Unremarkable Form", "Masterpiece Form"] }
];
