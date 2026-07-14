const STORAGE_KEY = "dnd_grug_2024_character_v1";
const APP_ID = "dnd-grug-2024";
const HISTORY_LIMIT = 100;
const AUTO_SYNC_PIN = "4242";
const AVAILABLE_CLASSES = ["rogue", "cleric"];
const TABS = [
  { id:"stats", label:"Stats" },
  { id:"combat", label:"Combat" },
  { id:"equipment", label:"Equip" },
  { id:"spells", label:"Spells" },
  { id:"notes", label:"Notes" },
  { id:"builder", label:"Builder" }
];
const ABILITIES = ["STR","DEX","CON","INT","WIS","CHA"];
const ABILITY_LABELS = {
  STR:"Strength",
  DEX:"Dexterity",
  CON:"Constitution",
  INT:"Intelligence",
  WIS:"Wisdom",
  CHA:"Charisma"
};
const SKILLS = [
  { name:"Athletics", abil:"STR" },
  { name:"Acrobatics", abil:"DEX" },
  { name:"Sleight of Hand", abil:"DEX" },
  { name:"Stealth", abil:"DEX" },
  { name:"Arcana", abil:"INT" },
  { name:"History", abil:"INT" },
  { name:"Investigation", abil:"INT" },
  { name:"Nature", abil:"INT" },
  { name:"Religion", abil:"INT" },
  { name:"Animal Handling", abil:"WIS" },
  { name:"Insight", abil:"WIS" },
  { name:"Medicine", abil:"WIS" },
  { name:"Perception", abil:"WIS" },
  { name:"Survival", abil:"WIS" },
  { name:"Deception", abil:"CHA" },
  { name:"Intimidation", abil:"CHA" },
  { name:"Performance", abil:"CHA" },
  { name:"Persuasion", abil:"CHA" }
];
const CLASS_RULES = {
  artificer:{ name:"Artificer", hitDie:8, saves:["CON","INT"], subclassLevel:3, spellcasting:"half", spellAbility:"INT", asi:[4,8,12,16,19] },
  barbarian:{ name:"Barbarian", hitDie:12, saves:["STR","CON"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,8,12,16,19] },
  bard:{ name:"Bard", hitDie:8, saves:["DEX","CHA"], subclassLevel:3, spellcasting:"full", spellAbility:"CHA", asi:[4,8,12,16,19] },
  cleric:{ name:"Cleric", hitDie:8, saves:["WIS","CHA"], subclassLevel:3, spellcasting:"full", spellAbility:"WIS", asi:[4,8,12,16] },
  druid:{ name:"Druid", hitDie:8, saves:["INT","WIS"], subclassLevel:2, spellcasting:"full", spellAbility:"WIS", asi:[4,8,12,16,19] },
  fighter:{ name:"Fighter", hitDie:10, saves:["STR","CON"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,6,8,12,14,16,19] },
  monk:{ name:"Monk", hitDie:8, saves:["STR","DEX"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,8,12,16,19] },
  paladin:{ name:"Paladin", hitDie:10, saves:["WIS","CHA"], subclassLevel:3, spellcasting:"half", spellAbility:"CHA", asi:[4,8,12,16,19] },
  ranger:{ name:"Ranger", hitDie:10, saves:["STR","DEX"], subclassLevel:3, spellcasting:"half", spellAbility:"WIS", asi:[4,8,12,16,19] },
  rogue:{ name:"Rogue", hitDie:8, saves:["DEX","INT"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,8,10,12,16] },
  sorcerer:{ name:"Sorcerer", hitDie:6, saves:["CON","CHA"], subclassLevel:1, spellcasting:"full", spellAbility:"CHA", asi:[4,8,12,16,19] },
  warlock:{ name:"Warlock", hitDie:8, saves:["WIS","CHA"], subclassLevel:1, spellcasting:"warlock", spellAbility:"CHA", asi:[4,8,12,16,19] },
  wizard:{ name:"Wizard", hitDie:6, saves:["INT","WIS"], subclassLevel:2, spellcasting:"full", spellAbility:"INT", asi:[4,8,12,16,19] }
};
const CLASS_SHORT_LABELS = {
  artificer:"Art",
  barbarian:"Barb",
  bard:"Brd",
  cleric:"Clr",
  druid:"Drd",
  fighter:"Ftr",
  monk:"Monk",
  paladin:"Pal",
  ranger:"Rgr",
  rogue:"Rog",
  sorcerer:"Sor",
  warlock:"Wlk",
  wizard:"Wiz"
};
const FULL_CASTER_SLOTS = {
  1:[2,0,0,0,0,0,0,0,0],
  2:[3,0,0,0,0,0,0,0,0],
  3:[4,2,0,0,0,0,0,0,0],
  4:[4,3,0,0,0,0,0,0,0],
  5:[4,3,2,0,0,0,0,0,0],
  6:[4,3,3,0,0,0,0,0,0],
  7:[4,3,3,1,0,0,0,0,0],
  8:[4,3,3,2,0,0,0,0,0],
  9:[4,3,3,3,1,0,0,0,0],
  10:[4,3,3,3,2,0,0,0,0],
  11:[4,3,3,3,2,1,0,0,0],
  12:[4,3,3,3,2,1,0,0,0],
  13:[4,3,3,3,2,1,1,0,0],
  14:[4,3,3,3,2,1,1,0,0],
  15:[4,3,3,3,2,1,1,1,0],
  16:[4,3,3,3,2,1,1,1,0],
  17:[4,3,3,3,2,1,1,1,1],
  18:[4,3,3,3,3,1,1,1,1],
  19:[4,3,3,3,3,2,1,1,1],
  20:[4,3,3,3,3,2,2,1,1]
};
const WARLOCK_PACT_SLOTS = {
  1:{ slots:1, level:1 },
  2:{ slots:2, level:1 },
  3:{ slots:2, level:2 },
  4:{ slots:2, level:2 },
  5:{ slots:2, level:3 },
  6:{ slots:2, level:3 },
  7:{ slots:2, level:4 },
  8:{ slots:2, level:4 },
  9:{ slots:2, level:5 },
  10:{ slots:2, level:5 },
  11:{ slots:3, level:5 },
  12:{ slots:3, level:5 },
  13:{ slots:3, level:5 },
  14:{ slots:3, level:5 },
  15:{ slots:3, level:5 },
  16:{ slots:3, level:5 },
  17:{ slots:4, level:5 },
  18:{ slots:4, level:5 },
  19:{ slots:4, level:5 },
  20:{ slots:4, level:5 }
};
const ARMORS = [
  { id:"none", name:"Unarmoured", base:10, dexCap:null, type:"none" },
  { id:"mage-armor", name:"Mage Armor", base:13, dexCap:null, type:"magic" },
  { id:"leather", name:"Leather", base:11, dexCap:null, type:"light" },
  { id:"studded-leather", name:"Studded Leather", base:12, dexCap:null, type:"light" },
  { id:"hide", name:"Hide", base:12, dexCap:2, type:"medium" },
  { id:"chain-shirt", name:"Chain Shirt", base:13, dexCap:2, type:"medium" },
  { id:"scale-mail", name:"Scale Mail", base:14, dexCap:2, type:"medium" },
  { id:"breastplate", name:"Breastplate", base:14, dexCap:2, type:"medium" },
  { id:"half-plate", name:"Half Plate", base:15, dexCap:2, type:"medium" }
];
const SHIELDS = [
  { id:"none", name:"No Shield", ac:0 },
  { id:"shield", name:"Shield", ac:2 }
];
const CLOAKS = [
  { id:"none", name:"No Cloak" },
  { id:"cloak-of-displacement", name:"Cloak of Displacement" }
];
const RINGS = [
  { id:"none", name:"No Ring" },
  { id:"ring-of-obscuring", name:"Ring of Obscuring" }
];
const WEAPONS = [
  { id:"none", name:"None", damage:"", ability:"" },
  { id:"hand-crossbow", name:"Hand Crossbow", damage:"1d6", damageType:"piercing", type:"ranged", ability:"DEX", range:"30/120", tags:["loading","light"] },
  { id:"battleaxe-plus-1", name:"+1 Battleaxe", damage:"1d8", damageType:"slashing", type:"melee", ability:"STR", attackBonus:1, damageBonus:1, versatile:"1d10", tags:["versatile"] },
  { id:"rapier-plus-1", name:"+1 Rapier", damage:"1d8", damageType:"piercing", type:"melee", ability:"DEX", finesse:true, attackBonus:1, damageBonus:1 },
  { id:"longbow", name:"Longbow", damage:"1d8", damageType:"piercing", type:"ranged", ability:"DEX", range:"150/600" },
  { id:"shortbow-plus-1", name:"+1 Shortbow", damage:"1d6", damageType:"piercing", type:"ranged", ability:"DEX", attackBonus:1, damageBonus:1, range:"80/320" }
];
const SAMPLE_SPELLS = {
  jefferson:["Guidance","Toll the Dead","Bless","Shield of Faith"]
};
const SUBCLASS_OVERRIDES_2024 = {
  cleric:[
    { slug:"cleric:grave", name:"Grave Domain", source:"Player's Handbook (2024)" },
    { slug:"cleric:knowledge", name:"Knowledge Domain", source:"Player's Handbook (2024)" },
    { slug:"cleric:life", name:"Life Domain", source:"Player's Handbook (2024)" },
    { slug:"cleric:light", name:"Light Domain", source:"Player's Handbook (2024)" },
    { slug:"cleric:trickery", name:"Trickery Domain", source:"Player's Handbook (2024)" },
    { slug:"cleric:war", name:"War Domain", source:"Player's Handbook (2024)" }
  ],
  rogue:[
    { slug:"rogue:arcane-trickster", name:"Arcane Trickster", source:"Player's Handbook (2024)" },
    { slug:"rogue:assassin", name:"Assassin", source:"Player's Handbook (2024)" },
    { slug:"rogue:phantom", name:"Phantom", source:"Player's Handbook (2024)" },
    { slug:"rogue:scion-of-the-three", name:"Scion of the Three", source:"Player's Handbook (2024)" },
    { slug:"rogue:soulknife", name:"Soulknife", source:"Player's Handbook (2024)" },
    { slug:"rogue:thief", name:"Thief", source:"Player's Handbook (2024)" }
  ]
};
const SUBCLASS_DETAILS_2024 = {
  "rogue:arcane-trickster":{
    source:"Player's Handbook (2024)",
    mechanics:[
      { section:"Level 3: Spellcasting", text:"You gain Arcane Trickster spellcasting. You know Mage Hand and two other Wizard cantrips, learn another Wizard cantrip at Rogue 10, and prepare Wizard spells from the Arcane Trickster table. Intelligence is your spellcasting ability, and you can use an Arcane Focus as your spellcasting focus." },
      { section:"Level 3: Mage Hand Legerdemain", text:"You can cast Mage Hand as a Bonus Action, make the spectral hand Invisible, control it as a Bonus Action, and make Dexterity (Sleight of Hand) checks through it." },
      { section:"Level 9: Magical Ambush", text:"If you have the Invisible condition when you cast a spell on a creature, it has Disadvantage on saving throws against that spell on the same turn." },
      { section:"Level 13: Versatile Trickster", text:"When you use the Trip option of your Cunning Strike on a creature, you can also use that option on another creature within 5 feet of your spectral Mage Hand." },
      { section:"Level 17: Spell Thief", text:"Immediately after a creature casts a spell that targets you or includes you in its area, you can use your Reaction to force an Intelligence save against your spell save DC. On a failure, the spell has no effect on you, and if it is level 1+ and of a level you can cast, you prepare it for 8 hours while the caster cannot cast it. Once you steal a spell this way, you must finish a Long Rest before doing so again." }
    ]
  },
  "rogue:assassin":{
    source:"Player's Handbook (2024)",
    mechanics:[
      { section:"Level 3: Assassinate", text:"You have Advantage on Initiative rolls. During the first round of each combat, you have Advantage on attack rolls against creatures that have not taken a turn yet. If your Sneak Attack hits during that round, the target takes extra damage of the weapon's type equal to your Rogue level." },
      { section:"Level 3: Assassin's Tools", text:"You gain a Disguise Kit and a Poisoner's Kit, and you have proficiency with them." },
      { section:"Level 9: Infiltration Expertise", text:"You can unerringly mimic another person's speech, handwriting, or both after studying them for at least 1 hour. Your Speed also is not reduced to 0 by using Steady Aim." },
      { section:"Level 13: Envenom Weapons", text:"When you use the Poison option of your Cunning Strike, the target also takes 2d6 Poison damage whenever it fails the saving throw. This damage ignores Resistance to Poison damage." },
      { section:"Level 17: Death Strike", text:"When you hit with your Sneak Attack on the first round of a combat, the target must make a Constitution saving throw against DC 8 + your Dexterity modifier + your Proficiency Bonus. On a failure, the attack's damage is doubled against the target." }
    ]
  },
  "rogue:phantom":{
    source:"Ravenloft - The Horrors Within (2024)",
    mechanics:[
      { section:"Level 3: Wails from the Grave", text:"Immediately after you deal Sneak Attack damage on your turn, you can target a second creature within 30 feet of the first and deal Necrotic damage equal to half your Sneak Attack dice, rounded up. You can use this a number of times equal to your Dexterity modifier, minimum once, and regain all uses on a Long Rest." },
      { section:"Level 3: Whispers of the Dead", text:"Whenever you finish a Short or Long Rest, choose one skill or tool proficiency you lack and gain it until you use this feature again to choose a different proficiency." },
      { section:"Level 9: Tokens of the Departed", text:"You gain soul trinkets with special uses: Death's Knell lets you trigger Wails from the Grave without spending a use, Life Essence gives Advantage on Death Saves and Constitution saves while you have a trinket, and Spirit Query lets you destroy a trinket to cast Augury or question the spirit tied to the trinket. You start with a maximum of two trinkets, increasing to three at Rogue 13 and four at Rogue 17." },
      { section:"Level 9: Voice of Death", text:"You can cast Speak with Dead once without a spell slot, regaining that use on a Short or Long Rest. You can target one of your soul trinkets instead of a corpse." },
      { section:"Level 13: Ghost Walk", text:"As a Bonus Action, you gain a spectral form for 10 minutes that grants a Fly Speed of 10 feet with hover, Disadvantage on attack rolls against you, and movement through creatures and objects as Difficult Terrain. If you end your turn inside a creature or object, you take 1d10 Force damage. You regain this after a Long Rest, or by destroying a soul trinket." },
      { section:"Level 17: Death's Friend", text:"When you use Wails from the Grave, you can deal its Necrotic damage to both the first and second creature. When you roll Initiative and have no soul trinkets, you gain one." }
    ]
  },
  "rogue:scion-of-the-three":{
    source:"Forgotten Realms - Heroes of Faerun (2024)",
    mechanics:[
      { section:"Level 3: Bloodthirst", text:"When an enemy within 30 feet takes damage and becomes Bloodied without dying, you can use your Reaction to teleport to an unoccupied space within 5 feet of it and make one melee attack. Uses equal your Intelligence modifier, minimum once, and refresh on a Long Rest." },
      { section:"Level 3: Dread Allegiance", text:"Choose Bane, Bhaal, or Myrkul when you finish a Long Rest. You gain a matching damage Resistance and cantrip: Bane gives Psychic resistance and Minor Illusion, Bhaal gives Poison resistance and Blade Ward, and Myrkul gives Necrotic resistance and Chill Touch. Intelligence is your spellcasting ability for the cantrip." },
      { section:"Level 9: Strike Fear", text:"You gain the Terrify Cunning Strike option, cost 1d6. The target makes a Wisdom save or becomes Frightened for 1 minute, and while Frightened this way you have Advantage on attack rolls against it. It repeats the save at the end of each turn." },
      { section:"Level 13: Aura of Malevolence", text:"When you use Bloodthirst and teleport, creatures of your choice within 10 feet of either the space you left or the destination space take damage equal to your Intelligence modifier. The damage type matches your Dread Allegiance resistance and ignores Resistance." },
      { section:"Level 17: Dread Incarnate", text:"You regain one expended use of Bloodthirst on a Short Rest, and when you roll Sneak Attack damage you can treat any die roll of 1 or 2 as a 3." }
    ]
  },
  "rogue:soulknife":{
    source:"Player's Handbook (2024)",
    mechanics:[
      { section:"Level 3: Psionic Power", text:"You gain Psionic Energy Dice that fuel subclass features. You regain one expended die on a Short Rest and all expended dice on a Long Rest. Psi-Bolstered Knack lets you add a die to a failed proficient skill or tool check, expending it only if that turns the failure into success. Psychic Whispers lets you establish telepathy with creatures you can see for a number of hours equal to a rolled Psionic Energy Die." },
      { section:"Level 3: Psychic Blades", text:"Whenever you take the Attack action or make an Opportunity Attack, you can manifest a Psychic Blade in a free hand. It is a Simple Melee weapon that deals 1d6 Psychic damage plus the ability modifier used for the attack, has Finesse and Thrown (60/120), and Vex mastery that does not count against your mastery limit. After attacking with it on your turn, you can make a Bonus Action attack with a second blade for 1d4 Psychic damage if your other hand is free." },
      { section:"Level 9: Soul Blades", text:"Homing Strikes lets you expend a Psionic Energy Die to add it to a missed Psychic Blade attack roll, expending it only if the attack then hits. Psychic Teleportation lets you expend a die, throw a blade, and teleport up to 10 times the die roll in feet to an unoccupied space you can see." },
      { section:"Level 13: Psychic Veil", text:"As a Magic action, you gain the Invisible condition for 1 hour or until you dismiss it, deal damage, or force a save. You regain the use after a Long Rest, or by expending a Psionic Energy Die." },
      { section:"Level 17: Rend Mind", text:"When your Psychic Blades deal Sneak Attack damage to a creature, you can force a Wisdom save against DC 8 + Dexterity modifier + Proficiency Bonus. On a failure, the target is Stunned for 1 minute, repeating the save at the end of each turn. You regain the use after a Long Rest, or by expending three Psionic Energy Dice." }
    ]
  },
  "rogue:thief":{
    source:"Player's Handbook (2024)",
    mechanics:[
      { section:"Level 3: Fast Hands", text:"As a Bonus Action, you can make a Dexterity (Sleight of Hand) check to pick a lock, disarm a trap with Thieves' Tools, or pick a pocket. You can also take the Utilize action or the Magic action to use a magic item that requires that action." },
      { section:"Level 3: Second Story Work", text:"You gain a Climb Speed equal to your Speed, and you can determine your jump distance using Dexterity instead of Strength." },
      { section:"Level 9: Supreme Sneak", text:"You gain the Stealth Attack Cunning Strike option, cost 1d6. If you have the Hide action's Invisible condition, this attack does not end that condition if you end the turn behind Three-Quarters Cover or Total Cover." },
      { section:"Level 13: Use Magic Device", text:"You can attune to up to four magic items at once. Whenever you use a magic item property that expends charges, roll 1d6; on a 6, no charges are spent. You can also use any Spell Scroll with Intelligence as your spellcasting ability. Cantrip and level 1 scrolls work automatically; higher-level scrolls require an Intelligence (Arcana) check against DC 10 + spell level or the scroll disintegrates." },
      { section:"Level 17: Thief's Reflexes", text:"You take two turns during the first round of any combat: one at your normal Initiative and a second at Initiative minus 10." }
    ]
  },
  "cleric:war":{
    source:"Player's Handbook (2024)",
    mechanics:[
      { section:"Level 3: Guided Strike", text:"When you or a creature within 30 feet misses with an attack roll, you can expend one use of Channel Divinity to give that roll a +10 bonus, potentially causing it to hit. If you use this to help another creature, it costs your Reaction." },
      { section:"Level 3: War Domain Spells", text:"You always have these spells prepared by Cleric level: 3 - Guiding Bolt, Magic Weapon, Shield of Faith, Spiritual Weapon. 5 - Crusader's Mantle, Spirit Guardians. 7 - Fire Shield, Freedom of Movement. 9 - Hold Monster, Steel Wind Strike." },
      { section:"Level 3: War Priest", text:"As a Bonus Action, you can make one attack with a weapon or an Unarmed Strike. Uses equal your Wisdom modifier, minimum once, and refresh on a Short or Long Rest." },
      { section:"Level 6: War God's Blessing", text:"You can expend a use of Channel Divinity to cast Shield of Faith or Spiritual Weapon without expending a spell slot. When cast this way, the spell does not require Concentration, lasts for 1 minute, and ends early if you cast that spell again, gain the Incapacitated condition, or die." },
      { section:"Level 17: Avatar of Battle", text:"You gain Resistance to Bludgeoning, Piercing, and Slashing damage." }
    ]
  }
};
const CLASS_FEATURE_OVERRIDES_2024 = {
  cleric:{
    1:"Spellcasting, Divine Order",
    2:"Channel Divinity",
    3:"Cleric Subclass",
    4:"Ability Score Improvement",
    5:"Sear Undead",
    7:"Blessed Strikes",
    8:"Ability Score Improvement",
    10:"Divine Intervention",
    12:"Ability Score Improvement",
    14:"Improved Blessed Strikes",
    16:"Ability Score Improvement",
    19:"Epic Boon",
    20:"Greater Divine Intervention"
  },
  rogue:{
    1:"Expertise, Sneak Attack, Thieves' Cant, Weapon Mastery",
    2:"Cunning Action",
    3:"Rogue Subclass, Steady Aim",
    4:"Ability Score Improvement",
    5:"Cunning Strike, Uncanny Dodge",
    6:"Expertise",
    7:"Evasion, Reliable Talent",
    8:"Ability Score Improvement",
    9:"Subclass Feature",
    10:"Ability Score Improvement",
    11:"Improved Cunning Strike",
    12:"Ability Score Improvement",
    13:"Subclass Feature",
    14:"Devious Strikes",
    15:"Slippery Mind",
    17:"Subclass Feature",
    18:"Elusive",
    19:"Epic Boon",
    20:"Stroke of Luck"
  }
};

let db = { lineages:[], backgrounds:[], feats:[], classes:[], subclasses:[] };
let dbMaps = { lineages:new Map(), backgrounds:new Map(), feats:new Map(), classes:new Map(), subclasses:new Map() };
let state = null;
let saveTimer = null;
let pullInFlight = false;
let spellEditorDraft = null;

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function abilityMod(score){
  return Math.floor((score - 10) / 2);
}

function fmtMod(value){
  return value >= 0 ? `+${value}` : `${value}`;
}

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function ordinal(level){
  if (level % 100 >= 11 && level % 100 <= 13) return `${level}th`;
  if (level % 10 === 1) return `${level}st`;
  if (level % 10 === 2) return `${level}nd`;
  if (level % 10 === 3) return `${level}rd`;
  return `${level}th`;
}

function normalizeCode(value){
  return String(value || "").trim().replace(/\s+/g, "-");
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value){
  return escapeHtml(value).replace(/'/g, "&#39;");
}

function unique(list){
  return Array.from(new Set((list || []).filter(Boolean)));
}

function use2024ClassRules(classSlug){
  return AVAILABLE_CLASSES.includes(classSlug);
}

function subclassOverrideItems(classSlug){
  const overrides = SUBCLASS_OVERRIDES_2024[classSlug];
  if (!overrides) return null;
  return overrides.map(item => ({
    slug:item.slug,
    name:item.name,
    meta:item.source,
    search:`${item.name} ${item.source}`.toLowerCase(),
    entry:Object.assign({
      slug:item.slug,
      name:item.name,
      source:item.source,
      raw_text:`${item.name} is available on this 2024 Grug sheet.`,
      mechanics:[]
    }, SUBCLASS_DETAILS_2024[item.slug] || {})
  }));
}

function parseNumberOrFallback(value, fallback){
  const text = String(value ?? "").trim();
  if (text === "") return fallback;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumberOrNull(value){
  const text = String(value ?? "").trim();
  if (text === "") return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function getSpellByName(name){
  const spells = window.SPELL_DATA || [];
  return spells.find(spell => spell.name === name) || null;
}

function pointBuyCost(score){
  const costs = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
  return costs[score] ?? 0;
}

function createBlankProfile(id = `profile-${Date.now()}`){
  const progression = Array.from({ length:20 }, () => ({
    classSlug:"",
    subclassSlug:"",
    asiMode:"",
    asiChoices:[],
    featSlug:"",
    expertiseChoices:[]
  }));
  return {
    id,
    name:"New Character",
    portrait:"./alaric-headshot.png",
    coins:{ cp:0, sp:0, gp:0 },
    speciesSlug:"",
    backgroundSlug:"",
    targetLevel:1,
    pointBuyBase:{ STR:8, DEX:8, CON:8, INT:8, WIS:8, CHA:8 },
    manualBase:{ STR:8, DEX:8, CON:8, INT:8, WIS:8, CHA:8 },
    statMode:"pointbuy",
    statRolls:[],
    rollAssignments:{},
    speciesAsiChoices:[],
    backgroundSelections:{ skills:[], tools:[], languages:[] },
    selectedSkills:[],
    selectedSaves:[],
    selectedFeats:[],
    progression,
    hpRolls:[],
    hpMaxOverride:null,
    currentHp:1,
    customBaseAc:null,
    initBonus:0,
    speedOverride:null,
    profOverride:null,
    thp:0,
    slotCur:{},
    pactSlotsCur:0,
    hitDiceCur:{},
    activePage:"stats",
    attackModes:{},
    history:[],
    equipment:{ armorId:"none", shieldId:"none", cloakId:"none", ringId:"none", weaponIds:["none","none","none"] },
    knownSpells:[],
    preparedSpells:[],
    extraSpells:[],
    spellbookView:"book",
    spellbookLimitsCollapsed:false,
    spellFilters:{
      search:"",
      class:"all",
      minLevel:0,
      maxLevel:9,
      sort:"level"
    },
    quickSpells:["","","",""],
    coreRollType:"check",
    coreAdvMode:"-",
    skillAdvMode:"-",
    concentrationMode:"-",
    concentrationActive:"",
    notes:"",
    syncCode:"",
    autoSync:false,
    resources:{
      bladesongActive:false,
      bladesongUsed:0,
      breathWeaponUsed:0,
      channelDivinityUsed:0,
      hexbladeCurseUsed:0,
      hexbladeCurseActive:false,
      warPriestUsed:0,
      rageUsed:0,
      fogCloudUsed:0,
      sneakAttackReady:false,
      sneakAttackDismissed:false,
      steadyAimActive:false,
      cunningStrikeEffects:[],
      sharpshooterActive:false,
      firstRoundTargetActive:false
    }
  };
}

function buildSampleProfiles(){
  const jefferson = ensureProfileShape({
    id:"jefferson",
    name:"Jefferson Grug",
    portrait:"./alaric-headshot.png",
    coins:{ cp:5, sp:17, gp:24 },
    speciesSlug:"lineage:half-orc",
    backgroundSlug:"background:mercenary-veteran",
    targetLevel:10,
    pointBuyBase:{ STR:10, DEX:16, CON:15, INT:10, WIS:18, CHA:12 },
    manualBase:{ STR:10, DEX:15, CON:15, INT:8, WIS:14, CHA:8 },
    statMode:"pointbuy",
    statRolls:[],
    rollAssignments:{},
    speciesAsiChoices:[
      { ability:"STR", amount:2 },
      { ability:"CON", amount:1 }
    ],
    backgroundSelections:{ skills:[], tools:[], languages:[] },
    selectedSkills:["Athletics","Sleight of Hand","Stealth","Nature","Religion","Insight","Perception","Survival","Persuasion"],
    selectedSaves:[],
    selectedFeats:[],
    progression:[
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:["Nature","Survival"] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"asi", asiChoices:[{ ability:"CON", amount:2 }], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"asi", asiChoices:[{ ability:"DEX", amount:2 }], featSlug:"", expertiseChoices:["Perception","Sleight of Hand"] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"asi", asiChoices:[{ ability:"CHA", amount:2 }], featSlug:"", expertiseChoices:[] },
      { classSlug:"cleric", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"cleric", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] },
      { classSlug:"rogue", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] }
    ],
    hpRolls:[
      { level:2, classSlug:"cleric", hitDie:8, roll:4, chosen:4 },
      { level:3, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:4, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:5, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:6, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:7, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:8, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:9, classSlug:"rogue", hitDie:8, roll:4, chosen:4 },
      { level:10, classSlug:"rogue", hitDie:8, roll:4, chosen:4 }
    ],
    hpMaxOverride:null,
    currentHp:84,
    customBaseAc:null,
    initBonus:0,
    speedOverride:null,
    profOverride:null,
    thp:0,
    slotCur:{ 1:3, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 },
    pactSlotsCur:0,
    hitDiceCur:{ d8:10 },
    activePage:"stats",
    attackModes:{
      "longbow":{ crit:false, adv:"-" },
      "Word of Radiance":{ crit:false, adv:"adv" }
    },
    history:[],
    equipment:{ armorId:"studded-leather", shieldId:"none", cloakId:"cloak-of-displacement", ringId:"ring-of-obscuring", weaponIds:["rapier-plus-1","longbow","shortbow-plus-1"] },
    knownSpells:["Guidance","Shield of Faith","Find Traps","Word of Radiance"],
    preparedSpells:["Guidance","Shield of Faith","Find Traps","Word of Radiance"],
    extraSpells:[],
    spellbookView:"book",
    spellbookLimitsCollapsed:false,
    spellFilters:{ search:"word o", class:"all", minLevel:0, maxLevel:2, sort:"level" },
    quickSpells:["Bless","Shield of Faith","Guidance","Toll the Dead"],
    coreRollType:"save",
    coreAdvMode:"-",
    skillAdvMode:"-",
    concentrationMode:"-",
    concentrationActive:"",
    notes:"",
    syncCode:"",
    autoSync:false,
    resources:{
      bladesongActive:false,
      bladesongUsed:0,
      breathWeaponUsed:0,
      channelDivinityUsed:0,
      hexbladeCurseUsed:0,
      hexbladeCurseActive:false,
      warPriestUsed:0,
      rageUsed:0,
      fogCloudUsed:0,
      sneakAttackReady:false,
      sneakAttackDismissed:false,
      steadyAimActive:false,
      cunningStrikeEffects:[],
      sharpshooterActive:false,
      firstRoundTargetActive:false
    }
  });

  return { jefferson };
}

function createDefaultState(){
  return {
    version:1,
    activePage:"builder",
    currentProfileId:"jefferson",
    profiles:buildSampleProfiles(),
    lastSyncByProfile:{}
  };
}

function normalizeGrugState(rawState){
  const base = createDefaultState();
  const next = Object.assign({}, base, rawState || {});
  const sourceProfiles = rawState?.profiles || {};
  const fallback = sourceProfiles.jefferson
    || sourceProfiles[rawState?.currentProfileId]
    || sourceProfiles[Object.keys(sourceProfiles)[0]]
    || buildSampleProfiles().jefferson;
  next.profiles = { jefferson:ensureProfileShape(Object.assign({}, fallback, { id:"jefferson", name:fallback?.name || "Jefferson Grug" })) };
  next.currentProfileId = "jefferson";
  if (!TABS.some(tab => tab.id === next.activePage)){
    next.activePage = "stats";
  }
  return next;
}

function loadState(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!raw || typeof raw !== "object") return createDefaultState();
    return normalizeGrugState(raw);
  }catch{
    return createDefaultState();
  }
}

function ensureProfileShape(profile){
  const blank = createBlankProfile(profile.id || `profile-${Date.now()}`);
  Object.assign(blank, profile);
  blank.coins = Object.assign({}, blank.coins, profile.coins || {});
  blank.pointBuyBase = Object.assign({}, blank.pointBuyBase, profile.pointBuyBase || {});
  blank.manualBase = Object.assign({}, blank.manualBase, profile.manualBase || {});
  blank.rollAssignments = Object.assign({}, blank.rollAssignments || {});
  blank.resources = Object.assign({}, blank.resources, profile.resources || {});
  blank.equipment = Object.assign({}, blank.equipment, profile.equipment || {});
  const legacyWeaponMap = {
    "longbow-plus-1":"longbow",
    "shortbow":"shortbow-plus-1"
  };
  blank.backgroundSelections = Object.assign({}, blank.backgroundSelections, profile.backgroundSelections || {});
  blank.backgroundSelections.skills = unique(blank.backgroundSelections.skills || []);
  blank.backgroundSelections.tools = unique(blank.backgroundSelections.tools || []);
  blank.backgroundSelections.languages = unique(blank.backgroundSelections.languages || []);
  blank.equipment.weaponIds = Array.isArray(blank.equipment.weaponIds) ? blank.equipment.weaponIds.slice(0, 3) : ["none","none","none"];
  blank.equipment.cloakId = blank.equipment.cloakId || "none";
  blank.equipment.ringId = blank.equipment.ringId || "none";
  blank.equipment.weaponIds = blank.equipment.weaponIds.map(id => legacyWeaponMap[id] || id);
  while (blank.equipment.weaponIds.length < 3) blank.equipment.weaponIds.push("none");
  blank.progression = Array.isArray(profile.progression) ? profile.progression.slice(0, 20) : blank.progression;
  while (blank.progression.length < 20){
    blank.progression.push({ classSlug:"", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] });
  }
  blank.progression = blank.progression.map(row => Object.assign({ classSlug:"", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"", expertiseChoices:[] }, row));
  blank.knownSpells = unique(blank.knownSpells || blank.preparedSpells || []);
  blank.preparedSpells = unique(blank.preparedSpells || []);
  blank.selectedSkills = unique(blank.selectedSkills || []);
  blank.selectedSaves = unique(blank.selectedSaves || []);
  blank.extraSpells = Array.isArray(blank.extraSpells) ? blank.extraSpells.map(item => ({
    name:item?.name || "",
    known:item?.known !== false,
    prepared:Boolean(item?.prepared)
  })).filter(item => item.name) : [];
  blank.spellbookView = profile.spellbookView === "edit" ? "edit" : "book";
  blank.spellbookLimitsCollapsed = Boolean(profile.spellbookLimitsCollapsed);
  blank.spellFilters = Object.assign({}, blank.spellFilters, profile.spellFilters || {});
  blank.spellFilters.search = String(blank.spellFilters.search || "");
  blank.spellFilters.class = String(blank.spellFilters.class || "all");
  blank.spellFilters.minLevel = clamp(Number(blank.spellFilters.minLevel || 0), 0, 9);
  blank.spellFilters.maxLevel = clamp(Number(blank.spellFilters.maxLevel || 9), 0, 9);
  blank.spellFilters.sort = blank.spellFilters.sort === "az" ? "az" : "level";
  blank.quickSpells = Array.isArray(blank.quickSpells) ? blank.quickSpells.slice(0, 4) : ["","","",""];
  while (blank.quickSpells.length < 4) blank.quickSpells.push("");
  blank.selectedFeats = Array.isArray(blank.selectedFeats) ? blank.selectedFeats : [];
  blank.history = Array.isArray(blank.history) ? blank.history.slice(0, HISTORY_LIMIT) : [];
  blank.statRolls = Array.isArray(blank.statRolls) ? blank.statRolls : [];
  blank.hpRolls = Array.isArray(blank.hpRolls) ? blank.hpRolls : [];
  blank.hpMaxOverride = blank.hpMaxOverride == null ? null : Number(blank.hpMaxOverride);
  blank.resources.cunningStrikeEffects = Array.isArray(blank.resources.cunningStrikeEffects) ? unique(blank.resources.cunningStrikeEffects) : [];
  blank.resources.fogCloudUsed = clamp(Number(blank.resources.fogCloudUsed || 0), 0, 3);
  blank.resources.sneakAttackDismissed = Boolean(blank.resources.sneakAttackDismissed);
  blank.resources.sharpshooterActive = Boolean(blank.resources.sharpshooterActive);
  blank.resources.firstRoundTargetActive = Boolean(blank.resources.firstRoundTargetActive);
  if (blank.attackModes && typeof blank.attackModes === "object"){
    Object.entries(legacyWeaponMap).forEach(([oldId, newId]) => {
      if (blank.attackModes[oldId] && !blank.attackModes[newId]){
        blank.attackModes[newId] = blank.attackModes[oldId];
      }
      delete blank.attackModes[oldId];
    });
  }
  return blank;
}

function activeProfile(){
  return state.profiles[state.currentProfileId];
}

function saveState(options = {}){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipRender) render();
  scheduleAutoSync();
}

function pushHistory(text){
  const profile = activeProfile();
  const stamp = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });
  profile.history.unshift(`${stamp}  ${text}`);
  profile.history = profile.history.slice(0, HISTORY_LIMIT);
}

async function loadDb(){
  const files = ["lineages","backgrounds","feats","classes","subclasses"];
  const values = await Promise.all(files.map(file => fetch(`./data/dnd5e/${file}.json`).then(response => response.json())));
  db = {
    lineages:values[0],
    backgrounds:values[1],
    feats:values[2],
    classes:values[3],
    subclasses:values[4]
  };
  dbMaps = {
    lineages:new Map(db.lineages.map(item => [item.slug, item])),
    backgrounds:new Map(db.backgrounds.map(item => [item.slug, item])),
    feats:new Map(db.feats.map(item => [item.slug, item])),
    classes:new Map(db.classes.map(item => [item.slug, item])),
    subclasses:new Map(db.subclasses.map(item => [item.slug, item]))
  };
}

function entryBySlug(kind, slug){
  return dbMaps[kind].get(slug) || null;
}

function currentLevel(profile = activeProfile()){
  return clamp(Number(profile.targetLevel || 1), 1, 20);
}

function classShortLabel(classSlug){
  return CLASS_SHORT_LABELS[classSlug] || CLASS_RULES[classSlug]?.name || classSlug;
}

function progressionUpTo(profile = activeProfile(), level = currentLevel(profile)){
  return profile.progression.slice(0, level);
}

function classCounts(profile = activeProfile(), level = currentLevel(profile)){
  const counts = {};
  progressionUpTo(profile, level).forEach(row => {
    if (!row.classSlug) return;
    counts[row.classSlug] = (counts[row.classSlug] || 0) + 1;
  });
  return counts;
}

function profBonus(profile = activeProfile()){
  if (profile.profOverride != null && profile.profOverride !== ""){
    return Number(profile.profOverride) || 0;
  }
  const level = currentLevel(profile);
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function computeAbilityBonuses(profile = activeProfile()){
  const bonuses = { STR:0, DEX:0, CON:0, INT:0, WIS:0, CHA:0 };
  (profile.speciesAsiChoices || []).forEach(item => {
    if (item && bonuses[item.ability] != null){
      bonuses[item.ability] += Number(item.amount || 0);
    }
  });
  progressionUpTo(profile).forEach(row => {
    if (row.asiMode === "asi"){
      (row.asiChoices || []).forEach(item => {
        if (item && bonuses[item.ability] != null){
          bonuses[item.ability] += Number(item.amount || 0);
        }
      });
    }
    if (row.asiMode === "feat" && row.featSlug){
      const feat = entryBySlug("feats", row.featSlug);
      const raw = String((feat && feat.raw_text) || "");
      const match = raw.match(/Increase your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score by 1/i);
      if (match){
        const key = match[1].slice(0, 3).toUpperCase();
        if (bonuses[key] != null) bonuses[key] += 1;
      }
    }
  });
  return bonuses;
}

function finalAbilityScores(profile = activeProfile()){
  const base = profile.statMode === "manual" ? profile.manualBase : profile.pointBuyBase;
  const bonuses = computeAbilityBonuses(profile);
  const scores = {};
  ABILITIES.forEach(abil => {
    scores[abil] = Number(base[abil] || 8) + Number(bonuses[abil] || 0);
  });
  return scores;
}

function pointBuyRemaining(profile = activeProfile()){
  const base = profile.pointBuyBase;
  const spent = ABILITIES.reduce((sum, abil) => sum + pointBuyCost(Number(base[abil] || 8)), 0);
  return 27 - spent;
}

function explicitSkillsFromText(text){
  const match = String(text || "").match(/Skill Proficiencies:\s*([^\n]+)/i);
  if (!match) return [];
  if (/choice|choose|one of|two of|any/i.test(match[1])) return [];
  return SKILLS.map(skill => skill.name).filter(name => match[1].toLowerCase().includes(name.toLowerCase()));
}

function explicitToolsFromText(text){
  const match = String(text || "").match(/Tool Proficiencies:\s*([^\n]+)/i);
  return match ? match[1].trim() : "None";
}

function explicitLanguagesFromText(text){
  const match = String(text || "").match(/Languages:\s*([^\n]+)/i);
  return match ? match[1].trim() : "None";
}

function explicitEquipmentFromText(text){
  const match = String(text || "").match(/Equipment:\s*([^\n]+)/i);
  return match ? match[1].trim() : "None";
}

function splitChoiceList(text){
  return String(text || "")
    .replace(/\bor\b/gi, ",")
    .replace(/\band\b/gi, ",")
    .split(/,|\//)
    .map(item => item.replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean);
}

function parseBackgroundChoiceData(profile = activeProfile()){
  const background = entryBySlug("backgrounds", profile.backgroundSlug);
  const raw = String((background && background.raw_text) || "");
  const skillLine = extractLineValue(raw, "Skill Proficiencies");
  const toolLine = extractLineValue(raw, "Tool Proficiencies");
  const languageLine = extractLineValue(raw, "Languages");
  const fixedSkills = explicitSkillsFromText(raw);
  const skillOptions = /choice|choose|any|one of|two of/i.test(skillLine)
    ? SKILLS.map(skill => skill.name)
    : [];
  const toolOptions = /choice|choose|one type|one gaming set|musical instrument|artisan's tools|navigator|vehicles/i.test(toolLine)
    ? splitChoiceList(toolLine)
    : [];
  const languageOptions = /choice|choose|any/i.test(languageLine)
    ? ["Common","Dwarvish","Elvish","Giant","Gnomish","Goblin","Halfling","Orc","Abyssal","Celestial","Draconic","Deep Speech","Infernal","Primordial","Sylvan","Undercommon"]
    : [];
  return {
    fixedSkills,
    fixedTools:/choice|choose|any/i.test(toolLine) ? [] : splitChoiceList(toolLine === "None" ? "" : toolLine),
    fixedLanguages:/choice|choose|any/i.test(languageLine) ? [] : splitChoiceList(languageLine === "None" ? "" : languageLine),
    skillOptions,
    toolOptions,
    languageOptions,
    equipment:explicitEquipmentFromText(raw),
    abilities:extractBackgroundAbilities(background)
  };
}

function profileLanguages(profile = activeProfile()){
  const species = extractLanguageText(entryBySlug("lineages", profile.speciesSlug) || {});
  const backgroundData = parseBackgroundChoiceData(profile);
  return unique([
    ...splitChoiceList(species === "Not parsed." ? "" : species),
    ...backgroundData.fixedLanguages,
    ...(profile.backgroundSelections.languages || [])
  ]);
}

function extraSpellNames(profile = activeProfile(), filter = "known"){
  const manual = (profile.extraSpells || [])
    .filter(item => filter === "prepared" ? item.prepared : item.known)
    .map(item => item.name);
  return unique([...manual, ...automaticExtraSpellNames(profile, filter)]);
}

function automaticExtraSpellNames(profile = activeProfile(), filter = "known"){
  const names = [];
  const clericLevel = classCounts(profile).cleric || 0;
  if (hasSubclass(profile, "cleric:war") && clericLevel >= 3){
    names.push("Guiding Bolt", "Magic Weapon", "Shield of Faith", "Spiritual Weapon");
    if (clericLevel >= 5) names.push("Crusader's Mantle", "Spirit Guardians");
    if (clericLevel >= 7) names.push("Fire Shield", "Freedom of Movement");
    if (clericLevel >= 9) names.push("Hold Monster", "Steel Wind Strike");
  }
  return names;
}

function profileSkillProficiencies(profile = activeProfile()){
  const skills = [];
  const backgroundData = parseBackgroundChoiceData(profile);
  skills.push(...backgroundData.fixedSkills, ...(profile.backgroundSelections.skills || []));
  skills.push(...(profile.selectedSkills || []));
  return unique(skills);
}

function profileToolProficiencies(profile = activeProfile()){
  const backgroundData = parseBackgroundChoiceData(profile);
  const tools = [...backgroundData.fixedTools, ...(profile.backgroundSelections.tools || [])];
  if ((classCounts(profile).rogue || 0) > 0) tools.push("Thieves' Tools");
  if ((classCounts(profile).rogue || 0) >= 3 && hasSubclass(profile, "rogue:assassin")){
    tools.push("Disguise Kit", "Poisoner's Kit");
  }
  return unique(tools);
}

function profileSaveProficiencies(profile = activeProfile()){
  const firstClass = progressionUpTo(profile, 1)[0]?.classSlug;
  return unique([...(firstClass && CLASS_RULES[firstClass] ? CLASS_RULES[firstClass].saves : []), ...(profile.selectedSaves || [])]);
}

function profileSize(profile = activeProfile()){
  const species = entryBySlug("lineages", profile.speciesSlug);
  const text = String((species && species.raw_text) || "");
  const match = text.match(/Your size is (Small|Medium|Large)|You are (Small|Medium|Large)/i);
  return match ? (match[1] || match[2]) : "Medium";
}

function profileSpeed(profile = activeProfile()){
  if (profile.speedOverride != null && profile.speedOverride !== ""){
    let speed = Number(profile.speedOverride) || 0;
    if (profile.resources.bladesongActive) speed += 10;
    return speed;
  }
  const species = entryBySlug("lineages", profile.speciesSlug);
  const text = String((species && species.raw_text) || "");
  const match = text.match(/walking speed is (\d+)/i) || text.match(/base walking speed is (\d+)/i);
  let speed = match ? Number(match[1]) : 30;
  if (profile.resources.bladesongActive) speed += 10;
  return speed;
}

function armorById(id){
  return ARMORS.find(item => item.id === id) || ARMORS[0];
}

function shieldById(id){
  return SHIELDS.find(item => item.id === id) || SHIELDS[0];
}

function cloakById(id){
  return CLOAKS.find(item => item.id === id) || CLOAKS[0];
}

function ringById(id){
  return RINGS.find(item => item.id === id) || RINGS[0];
}

function weaponById(id){
  return WEAPONS.find(item => item.id === id) || WEAPONS[0];
}

function hasRingOfObscuring(profile = activeProfile()){
  return profile.equipment.ringId === "ring-of-obscuring";
}

function profileAc(profile = activeProfile()){
  const scores = finalAbilityScores(profile);
  let total = profileBaseAc(profile);
  const counts = classCounts(profile);
  if (profile.resources.bladesongActive && (counts.wizard || 0) >= 2 && progressionUpTo(profile).some(row => row.subclassSlug === "wizard:bladesinging")){
    total += Math.max(1, abilityMod(scores.INT));
  }
  if (String(profile.concentrationActive || "").toLowerCase() === "shield of faith"){
    total += 2;
  }
  if (profile.resources.hexbladeCurseActive) total += 0;
  return total;
}

function profileBaseAc(profile = activeProfile()){
  if (profile.customBaseAc != null && profile.customBaseAc !== ""){
    return Number(profile.customBaseAc) || 0;
  }
  const scores = finalAbilityScores(profile);
  const dexMod = abilityMod(scores.DEX);
  const armor = armorById(profile.equipment.armorId);
  const shield = shieldById(profile.equipment.shieldId);
  const dexContribution = armor.dexCap == null ? dexMod : Math.min(dexMod, armor.dexCap);
  return armor.base + dexContribution + shield.ac;
}

function profileInitiative(profile = activeProfile()){
  return abilityMod(finalAbilityScores(profile).DEX) + Number(profile.initBonus || 0);
}

function profileHitDice(profile = activeProfile()){
  const counts = classCounts(profile);
  const totals = {};
  Object.entries(counts).forEach(([classSlug, count]) => {
    const die = CLASS_RULES[classSlug]?.hitDie;
    if (die) totals[`d${die}`] = (totals[`d${die}`] || 0) + count;
  });
  return totals;
}

function calculatedHpMax(profile = activeProfile()){
  const rows = progressionUpTo(profile);
  const scores = finalAbilityScores(profile);
  const conMod = abilityMod(scores.CON);
  if (!rows.length || !rows[0].classSlug) return Math.max(1, 8 + conMod);
  let total = 0;
  rows.forEach((row, index) => {
    const hitDie = CLASS_RULES[row.classSlug]?.hitDie || 8;
    if (index === 0){
      total += hitDie + conMod;
      return;
    }
    const roll = profile.hpRolls[index - 1]?.chosen || Math.ceil(hitDie / 2);
    total += roll + conMod;
  });
  return Math.max(1, total);
}

function computeHpMax(profile = activeProfile()){
  const override = parseNumberOrNull(profile.hpMaxOverride);
  if (override != null) return Math.max(1, override);
  return calculatedHpMax(profile);
}

function seedAverageProgression(profile){
  const rows = progressionUpTo(profile);
  const scores = finalAbilityScores(profile);
  const conMod = abilityMod(scores.CON);
  if (!rows.length) return;
  profile.hpRolls = [];
  let hp = 0;
  rows.forEach((row, index) => {
    const hitDie = CLASS_RULES[row.classSlug]?.hitDie || 8;
    if (index === 0){
      hp += hitDie + conMod;
      return;
    }
    const chosen = Math.ceil(hitDie / 2);
    profile.hpRolls.push({ level:index + 1, classSlug:row.classSlug, hitDie, roll:chosen, chosen });
    hp += chosen + conMod;
  });
  profile.currentHp = Math.max(1, hp);
}

function spellcastingSummary(profile = activeProfile()){
  const counts = classCounts(profile);
  let casterLevel = 0;
  Object.entries(counts).forEach(([classSlug, count]) => {
    const rule = CLASS_RULES[classSlug];
    if (!rule) return;
    if (rule.spellcasting === "full") casterLevel += count;
    if (rule.spellcasting === "half") casterLevel += Math.floor(count / 2);
  });
  const slots = FULL_CASTER_SLOTS[Math.max(1, casterLevel)] || FULL_CASTER_SLOTS[1];
  const warlock = counts.warlock || 0;
  const pact = WARLOCK_PACT_SLOTS[warlock] || { slots:0, level:0 };
  return { casterLevel, slots, pact };
}

function spellAbility(profile = activeProfile()){
  const counts = classCounts(profile);
  const spellcasters = Object.keys(counts).filter(classSlug => {
    const rule = CLASS_RULES[classSlug];
    return rule && rule.spellcasting !== "none";
  });
  if (!spellcasters.length) return "INT";
  const sorted = spellcasters.sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  return CLASS_RULES[sorted[0]].spellAbility || "INT";
}

function spellDc(profile = activeProfile()){
  const ability = spellAbility(profile);
  return 8 + profBonus(profile) + abilityMod(finalAbilityScores(profile)[ability]);
}

function spellAttackMod(profile = activeProfile()){
  const ability = spellAbility(profile);
  return profBonus(profile) + abilityMod(finalAbilityScores(profile)[ability]);
}

function profileWeapons(profile = activeProfile()){
  return (profile.equipment.weaponIds || []).map(weaponById).filter(weapon => weapon.id !== "none");
}

function hasSubclass(profile, slug){
  return progressionUpTo(profile).some(row => row.subclassSlug === slug);
}

function currentSpellList(profile = activeProfile()){
  return unique([
    ...(profile.preparedSpells || []),
    ...(profile.knownSpells || []),
    ...extraSpellNames(profile, "known")
  ]).map(getSpellByName).filter(Boolean);
}

function skillMod(skillName, profile = activeProfile()){
  const skill = SKILLS.find(item => item.name === skillName);
  if (!skill) return 0;
  const scores = finalAbilityScores(profile);
  const proficient = profileSkillProficiencies(profile).includes(skillName);
  const expertise = profileExpertiseSkills(profile).includes(skillName);
  return abilityMod(scores[skill.abil]) + (proficient ? profBonus(profile) : 0) + (expertise ? profBonus(profile) : 0);
}

function saveMod(ability, profile = activeProfile()){
  const scores = finalAbilityScores(profile);
  return abilityMod(scores[ability]) + (profileSaveProficiencies(profile).includes(ability) ? profBonus(profile) : 0);
}

function classLabel(classSlug){
  return CLASS_RULES[classSlug]?.name || "Select Class";
}

function mainClasses(profile = activeProfile(), uptoLevel = null){
  const counts = classCounts(profile, uptoLevel || currentLevel(profile));
  const pairs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return {
    primary:pairs[0] || ["", 0],
    secondary:pairs[1] || ["", 0]
  };
}

function findClassFeatureText(profile = activeProfile(), levelIndex = 0){
  const row = profile.progression[levelIndex];
  if (!row.classSlug) return "";
  const classLevel = progressionUpTo(profile, levelIndex + 1).filter(item => item.classSlug === row.classSlug).length;
  const override = CLASS_FEATURE_OVERRIDES_2024[row.classSlug]?.[classLevel];
  if (row.classSlug === "rogue" && (classLevel === 1 || classLevel === 6)){
    return row.expertiseChoices?.length === 2
      ? `Expertise: ${row.expertiseChoices.join(", ")}`
      : "Select Expertise";
  }
  const subclassLevel = CLASS_RULES[row.classSlug]?.subclassLevel || 99;
  if (classLevel === subclassLevel){
    return row.subclassSlug ? entryBySlug("subclasses", row.subclassSlug)?.name || "Subclass" : "Select Subclass";
  }
  const asiLevels = CLASS_RULES[row.classSlug]?.asi || [];
  if (asiLevels.includes(classLevel)){
    if (row.asiMode === "feat" && row.featSlug){
      return entryBySlug("feats", row.featSlug)?.name || "Feat";
    }
    if (row.asiMode === "asi" && row.asiChoices?.length){
      return "Ability Score Improvement";
    }
    return "Select ASI or Feat";
  }
  if (override) return override;
  const classEntry = entryBySlug("classes", row.classSlug);
  if (!classEntry) return "";
  const target = String(ordinal(classLevel)).toLowerCase();
  const mechanic = (classEntry.mechanics || []).find(item => String(item.text || "").toLowerCase().includes(target));
  return mechanic ? mechanic.section : "";
}

function profileExpertiseSkills(profile = activeProfile()){
  return unique(progressionUpTo(profile).flatMap(row => row.expertiseChoices || []));
}

function expertiseEligibleSkills(profile = activeProfile(), levelIndex = 0){
  const currentRow = profile.progression[levelIndex];
  const alreadySelected = new Set(
    progressionUpTo(profile, levelIndex + 1)
      .filter((row, index) => index !== levelIndex)
      .flatMap(row => row.expertiseChoices || [])
  );
  return profileSkillProficiencies(profile).filter(skill => !alreadySelected.has(skill) || (currentRow.expertiseChoices || []).includes(skill));
}

function entrySummary(kind, slug){
  const entry = entryBySlug(kind, slug);
  return entry ? entry.name : "";
}

function detailLinesForEntry(entry, kind){
  if (!entry){
    return [{ label:"Selection", value:"None selected yet." }];
  }
  if (kind === "lineages"){
    return [
      { label:"ASI", value:extractAsiText(entry) || "No ASI text parsed." },
      { label:"Size", value:extractSizeText(entry) || "Not parsed." },
      { label:"Speed", value:extractSpeedText(entry) || "Not parsed." },
      { label:"Languages", value:extractLanguageText(entry) || "Not parsed." },
      { label:"Abilities", value:extractAbilityList(entry) || "None listed." }
    ];
  }
  return [
    { label:"Skill Proficiencies", value:explicitSkillsFromText(entry.raw_text).join(", ") || extractLineValue(entry.raw_text, "Skill Proficiencies") || "Not parsed." },
    { label:"Tool Proficiencies", value:explicitToolsFromText(entry.raw_text) || "Not parsed." },
    { label:"Languages", value:explicitLanguagesFromText(entry.raw_text) || "Not parsed." },
    { label:"Equipment", value:explicitEquipmentFromText(entry.raw_text) || "Not parsed." },
    { label:"Abilities", value:extractBackgroundAbilities(entry) || "None listed." }
  ];
}

function extractLineValue(text, label){
  const match = String(text || "").match(new RegExp(`${label}:\\s*([^\\n]+)`, "i"));
  return match ? match[1].trim() : "";
}

function extractAsiText(entry){
  const text = String(entry.raw_text || "");
  const match = text.match(/Ability Score Increase\.[^\n]+/i) || text.match(/Increase one ability score[^\n]+/i);
  return match ? match[0].trim() : "";
}

function extractSizeText(entry){
  const text = String(entry.raw_text || "");
  const match = text.match(/Your size is [^\n]+/i) || text.match(/You are (?:Small|Medium|Large)[^\n]*/i);
  return match ? match[0].trim() : "";
}

function extractSpeedText(entry){
  const text = String(entry.raw_text || "");
  const match = text.match(/walking speed is [^\n]+/i) || text.match(/base walking speed is [^\n]+/i);
  return match ? match[0].trim() : "";
}

function extractLanguageText(entry){
  return extractLineValue(entry.raw_text, "Languages");
}

function extractAbilityList(entry){
  const mechanics = (entry.mechanics || []).map(item => item.text).filter(text => {
    const lower = String(text).toLowerCase();
    return !lower.includes("ability score increase") && !lower.includes("size.") && !lower.includes("speed.") && !lower.includes("languages.");
  });
  return mechanics.slice(0, 8).join("\n\n");
}

function extractBackgroundAbilities(entry){
  const mechanics = (entry.mechanics || []).map(item => item.text);
  return mechanics.join("\n\n");
}

function openModal(html){
  document.getElementById("modal").innerHTML = html;
  document.getElementById("modalBack").classList.add("show");
  document.querySelectorAll("[data-close]").forEach(button => button.onclick = closeModal);
}

function closeModal(){
  document.getElementById("modalBack").classList.remove("show");
}

function openResult(title, text){
  openModal(`
    <div class="modal-head">
      <div class="modal-title">${escapeHtml(title)}</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="detail-box">${escapeHtml(text)}</div>
  `);
}

function openEntryInfo(entry){
  if (!entry){
    openResult("No Selection", "Nothing selected yet.");
    return;
  }
  const mechanics = (entry.mechanics || []).map(item => `[${item.section}] ${item.text}`).join("\n\n");
  openResult(entry.name, `${entry.source ? `Source: ${entry.source}\n\n` : ""}${mechanics || entry.raw_text || "No details available."}`);
}

function selectionModal({ title, items, onSelect }){
  const initialRows = items.map(item => renderSelectionRow(item)).join("");
  openModal(`
    <div class="modal-head">
      <div class="modal-title">${escapeHtml(title)}</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <div class="search-wrap">
        <input type="text" id="selectorSearch" placeholder="Search ${escapeHtml(title)}">
        <button class="small-btn" id="selectorClear">X</button>
      </div>
      <div class="list-grid" id="selectorList">${initialRows}</div>
    </div>
  `);
  const list = document.getElementById("selectorList");
  const renderList = query => {
    const filtered = items.filter(item => item.search.includes(query));
    list.innerHTML = filtered.map(item => renderSelectionRow(item)).join("") || `<div class="empty">No matches.</div>`;
    list.querySelectorAll("[data-select-slug]").forEach(button => {
      button.onclick = () => {
        onSelect(button.dataset.selectSlug);
        closeModal();
      };
    });
    list.querySelectorAll("[data-info-slug]").forEach(button => {
      button.onclick = () => {
        const item = items.find(entry => entry.slug === button.dataset.infoSlug);
        if (item) openEntryInfo(item.entry || item);
      };
    });
  };
  renderList("");
  document.getElementById("selectorSearch").oninput = event => renderList(event.target.value.trim().toLowerCase());
  document.getElementById("selectorClear").onclick = () => {
    document.getElementById("selectorSearch").value = "";
    renderList("");
  };
}

function renderSelectionRow(item){
  return `
    <div class="list-item">
      <button class="icon-btn" data-info-slug="${escapeHtml(item.slug)}">i</button>
      <button class="select-btn" data-select-slug="${escapeHtml(item.slug)}" style="justify-content:flex-start;">
        <span class="list-item-main">
          <span class="list-title">${escapeHtml(item.name)}</span>
          <span class="list-meta">${escapeHtml(item.meta || "")}</span>
        </span>
      </button>
    </div>
  `;
}

function speciesItems(){
  return db.lineages.map(entry => ({
    slug:entry.slug,
    name:entry.name,
    meta:entry.source || "",
    search:`${entry.name} ${entry.source || ""}`.toLowerCase(),
    entry
  }));
}

function backgroundItems(){
  return db.backgrounds.map(entry => ({
    slug:entry.slug,
    name:entry.name,
    meta:entry.source || "",
    search:`${entry.name} ${entry.source || ""}`.toLowerCase(),
    entry
  }));
}

function subclassItemsForClass(classSlug){
  const overrideItems = subclassOverrideItems(classSlug);
  if (overrideItems) return overrideItems;
  return db.subclasses.filter(entry => entry.parent_class === classSlug).map(entry => ({
    slug:entry.slug,
    name:entry.name,
    meta:entry.source || "",
    search:`${entry.name} ${entry.source || ""}`.toLowerCase(),
    entry
  }));
}

function featItems(){
  return db.feats.map(entry => ({
    slug:entry.slug,
    name:entry.name,
    meta:entry.source || "",
    search:`${entry.name} ${entry.source || ""}`.toLowerCase(),
    entry
  }));
}

function spellItemsForProfile(profile = activeProfile()){
  return (window.SPELL_DATA || []).map(spell => ({
    slug:spell.name,
    name:spell.name,
    meta:`L${spell.level} / ${spell.school || "-"} / ${spell.classes || "-"}`,
    search:`${spell.name} ${spell.school || ""} ${spell.classes || ""}`.toLowerCase(),
    spell
  }));
}

function spellSearchText(spell){
  return [
    spell.name,
    spell.school,
    spell.classes,
    spell.description,
    spell.range,
    spell.duration,
    spell.casting_time,
    spell.components
  ].filter(Boolean).join(" ").toLowerCase();
}

function spellClassOptions(profile = activeProfile()){
  const classes = Object.keys(classCounts(profile)).filter(classSlug => CLASS_RULES[classSlug]?.spellcasting !== "none");
  return ["all", ...classes];
}

function spellClassFilterLabel(value){
  return value === "all" ? "All Classes" : (CLASS_RULES[value]?.name || value);
}

function spellMatchesClassFilter(spell, classSlug){
  if (classSlug === "all") return true;
  const className = CLASS_RULES[classSlug]?.name || classSlug;
  return String(spell.classes || "").toLowerCase().includes(className.toLowerCase());
}

function spellEditorCounts(profile = activeProfile()){
  const draft = ensureSpellEditorDraft(profile);
  const knownList = Array.from(draft.known).map(getSpellByName).filter(Boolean);
  const preparedList = Array.from(draft.prepared).map(getSpellByName).filter(Boolean);
  return {
    known:knownList.length,
    prepared:preparedList.length,
    spellbook:knownList.filter(spell => Number(spell.level || 0) > 0).length
  };
}

function selectedFeaturesNeedChoice(profile = activeProfile()){
  const features = [];
  const species = entryBySlug("lineages", profile.speciesSlug);
  const backgroundData = parseBackgroundChoiceData(profile);
  if (species && /increase one ability score by 2 and increase a different one by 1|increase three different scores by 1/i.test(species.raw_text)){
    features.push("Species ASI choices are active.");
  }
  if (backgroundData.skillOptions.length && !(profile.backgroundSelections.skills || []).length){
    features.push("Background skill choice pending.");
  }
  if (backgroundData.toolOptions.length && !(profile.backgroundSelections.tools || []).length){
    features.push("Background tool choice pending.");
  }
  if (backgroundData.languageOptions.length && !(profile.backgroundSelections.languages || []).length){
    features.push("Background language choice pending.");
  }
  progressionUpTo(profile).forEach((row, index) => {
    const classLevel = progressionUpTo(profile, index + 1).filter(item => item.classSlug === row.classSlug).length;
    if (row.classSlug && classLevel === (CLASS_RULES[row.classSlug]?.subclassLevel || 99) && !row.subclassSlug){
      features.push(`Level ${index + 1}: choose a ${classLabel(row.classSlug)} subclass.`);
    }
    if (row.classSlug === "rogue" && (classLevel === 1 || classLevel === 6) && (row.expertiseChoices || []).length !== 2){
      features.push(`Level ${index + 1}: choose 2 expertise skills.`);
    }
    if ((CLASS_RULES[row.classSlug]?.asi || []).includes(classLevel) && !row.asiMode){
      features.push(`Level ${index + 1}: choose ASI or feat.`);
    }
  });
  return features;
}

function isFeatureChoicePending(profile, index){
  const row = profile.progression[index];
  if (!row?.classSlug) return false;
  const classLevel = progressionUpTo(profile, index + 1).filter(item => item.classSlug === row.classSlug).length;
  if (classLevel === (CLASS_RULES[row.classSlug]?.subclassLevel || 99) && !row.subclassSlug) return true;
  if (row.classSlug === "rogue" && (classLevel === 1 || classLevel === 6) && (row.expertiseChoices || []).length !== 2) return true;
  if ((CLASS_RULES[row.classSlug]?.asi || []).includes(classLevel) && !row.asiMode) return true;
  return false;
}

function spellbookAllowance(profile = activeProfile()){
  const wizard = classCounts(profile).wizard || 0;
  return wizard ? 6 + Math.max(0, (wizard - 1) * 2) : 0;
}

function preparedSpellLimit(profile = activeProfile()){
  const counts = classCounts(profile);
  const castingClass = spellAbility(profile);
  const ability = finalAbilityScores(profile)[castingClass] || 10;
  const fullCasterLevels = Object.entries(counts).reduce((sum, [classSlug, count]) => {
    const rule = CLASS_RULES[classSlug];
    return sum + (rule?.spellcasting === "full" ? count : 0);
  }, 0);
  return Math.max(0, fullCasterLevels + abilityMod(ability));
}

function updateTopIdentity(){
  const profile = activeProfile();
  const classes = classCounts(profile);
  const classSummary = Object.entries(classes).map(([slug, count]) => `${CLASS_RULES[slug]?.name || slug} ${count}`).join(" / ");
  document.getElementById("charName").textContent = profile.name || "New Character";
  document.getElementById("charSubtitle").textContent = `L${currentLevel(profile)} / ${entrySummary("lineages", profile.speciesSlug) || "No species"} / ${classSummary || "No classes yet"}`;
  document.getElementById("charPortrait").src = profile.portrait || "./alaric-headshot.png";
  document.getElementById("syncStatusBtn").textContent = profile.autoSync ? "Sync On" : "Local";
  document.getElementById("topChips").innerHTML = `
    <div class="chip green"><span>HP</span><b>${profile.currentHp}/${computeHpMax(profile)}</b></div>
    <div class="chip blue"><span>AC</span><b>${profileAc(profile)}</b></div>
    <div class="chip"><span>Init</span><b>${fmtMod(profileInitiative(profile))}</b></div>
    <div class="chip"><span>Speed</span><b>${profileSpeed(profile)}</b></div>
    <div class="chip gold"><span>Prof</span><b>${fmtMod(profBonus(profile))}</b></div>
  `;
}

function renderTabs(){
  const host = document.getElementById("bottomTabs");
  host.innerHTML = "";
  TABS.forEach(tab => {
    const button = document.createElement("button");
    button.className = `tab ${state.activePage === tab.id ? "active" : ""}`;
    button.textContent = tab.label;
    button.onclick = () => {
      state.activePage = tab.id;
      saveState();
    };
    host.appendChild(button);
  });
}

function renderPages(){
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle("active", page.dataset.page === state.activePage);
  });
}

function renderProfileSelector(){
  const select = document.getElementById("profileSelect");
  select.innerHTML = Object.values(state.profiles).map(profile => `<option value="${escapeHtml(profile.id)}"${profile.id === state.currentProfileId ? " selected" : ""}>${escapeHtml(profile.name)}</option>`).join("");
}

function renderBuilderPage(){
  const profile = activeProfile();
  const backgroundData = parseBackgroundChoiceData(profile);
  document.getElementById("builderNameInput").value = profile.name || "";
  document.getElementById("speciesSelectBtn").textContent = entrySummary("lineages", profile.speciesSlug) || "Select Species";
  document.getElementById("backgroundSelectBtn").textContent = entrySummary("backgrounds", profile.backgroundSlug) || "Select Background";
  document.getElementById("speciesDetails").innerHTML = detailLinesForEntry(entryBySlug("lineages", profile.speciesSlug), "lineages").map(item => `
    <div class="detail-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>
  `).join("");
  document.getElementById("backgroundDetails").innerHTML = [
    {
      label:"Skill Proficiencies",
      value:unique([...backgroundData.fixedSkills, ...(profile.backgroundSelections.skills || [])]).join(", ") || "None",
      editable:Boolean(backgroundData.skillOptions.length)
    },
    {
      label:"Tool Proficiencies",
      value:profileToolProficiencies(profile).join(", ") || "None",
      editable:Boolean(backgroundData.toolOptions.length)
    },
    {
      label:"Languages",
      value:unique([...backgroundData.fixedLanguages, ...(profile.backgroundSelections.languages || [])]).join(", ") || "None",
      editable:Boolean(backgroundData.languageOptions.length)
    },
    { label:"Equipment", value:backgroundData.equipment || "None", editable:false },
    { label:"Abilities", value:backgroundData.abilities || "None listed.", editable:false }
  ].map(item => `
    <div class="detail-item ${item.editable ? "editable" : ""}">
      <div><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>
      ${item.editable ? `<button class="small-btn" data-edit-background="${escapeAttr(item.label)}">Edit</button>` : ""}
    </div>
  `).join("");
  document.getElementById("pointBuyRemaining").textContent = `PB ${pointBuyRemaining(profile)}`;
  document.getElementById("builderStatsGrid").innerHTML = ABILITIES.map(abil => {
    const finalScores = finalAbilityScores(profile);
    const bonus = computeAbilityBonuses(profile)[abil];
    const base = profile.statMode === "manual" ? profile.manualBase[abil] : profile.pointBuyBase[abil];
    return `
      <div class="stat">
        <div class="stat-head">${abil}</div>
        <div class="stat-score">${finalScores[abil]}</div>
        <div class="stat-foot">
          <span class="stat-pair"><span class="muted">BASE</span><b>${base}</b></span>
          <span class="stat-pair"><span class="muted">MOD</span><b>${fmtMod(abilityMod(finalScores[abil]))}</b></span>
        </div>
        <div class="stat-controls">
          <button class="small-btn" data-stat-minus="${abil}">-</button>
          <button class="small-btn" data-stat-mode="${abil}">${profile.statMode === "manual" ? "Manual" : "Point Buy"}</button>
          <button class="small-btn" data-stat-plus="${abil}">+</button>
        </div>
        ${bonus ? `<div class="bonus-line">+${bonus} species/feat</div>` : `<div class="bonus-line">&nbsp;</div>`}
      </div>
    `;
  }).join("");
  document.getElementById("targetLevelInput").value = currentLevel(profile);
  document.getElementById("populateHint").textContent = selectedFeaturesNeedChoice(profile).join(" ") || "Populate uses the chosen progression and rolls HP level by level.";
  renderProgressionList();
}

function renderProgressionList(){
  const profile = activeProfile();
  const host = document.getElementById("progressionList");
  const runningCounts = {};
  host.innerHTML = profile.progression.map((row, index) => {
    if (row.classSlug){
      runningCounts[row.classSlug] = (runningCounts[row.classSlug] || 0) + 1;
    }
    const top = mainClasses(profile, index + 1);
    const feature = findClassFeatureText(profile, index);
    const pending = isFeatureChoicePending(profile, index);
    return `
      <div class="progression-row">
        <div>${index + 1}</div>
        <select data-level-class="${index}">
          <option value="">Select</option>
          ${AVAILABLE_CLASSES.map(classSlug => `<option value="${classSlug}"${row.classSlug === classSlug ? " selected" : ""}>${CLASS_RULES[classSlug].name}</option>`).join("")}
        </select>
        <div class="tag">${top.primary[1] || "-"}</div>
        <div class="tag">${top.secondary[1] || "-"}</div>
        <button class="small-btn feature-btn ${pending ? "required" : "ready"}" data-level-feature="${index}">${escapeHtml(feature || "-")}</button>
      </div>
    `;
  }).join("");
}

function renderStatsPage(){
  const profile = activeProfile();
  const scores = finalAbilityScores(profile);
  const classes = classCounts(profile);
  const classSummary = Object.entries(classes).map(([slug, count]) => `${classShortLabel(slug)} ${count}`).join(" / ");
  document.getElementById("statsCharName").textContent = profile.name || "New Character";
  document.getElementById("statsCharSubtitle").textContent = `L${currentLevel(profile)} / ${classSummary || "No classes yet"}`;
  document.getElementById("statsCharPortrait").src = profile.portrait || "./alaric-headshot.png";
  document.getElementById("statsTopChips").innerHTML = `
    <div class="chip green"><span>HP</span><b>${profile.currentHp}/${computeHpMax(profile)}</b></div>
    <div class="chip blue"><span>AC</span><b>${profileAc(profile)}</b></div>
    <div class="chip"><span>Init</span><b>${fmtMod(profileInitiative(profile))}</b></div>
    <div class="chip"><span>Speed</span><b>${profileSpeed(profile)}</b></div>
    <div class="chip gold"><span>Prof</span><b>${fmtMod(profBonus(profile))}</b></div>
  `;
  document.getElementById("coinsBtn").innerHTML = `
    <div>CP</div><strong>${profile.coins.cp}</strong>
    <div>SP</div><strong>${profile.coins.sp}</strong>
    <div>GP</div><strong>${profile.coins.gp}</strong>
  `;
  document.getElementById("eqText").textContent = `Eq ${(((profile.coins.cp || 0) / 100) + ((profile.coins.sp || 0) / 10) + (profile.coins.gp || 0)).toFixed(2)} gp`;
  document.getElementById("coreRollTypeBtn").textContent = profile.coreRollType === "save" ? "SAVE" : "CHECK";
  document.getElementById("coreAdvModeBtn").textContent = profile.coreAdvMode === "-" ? "-" : profile.coreAdvMode === "adv" ? "ADV" : "DIS";
  document.getElementById("skillAdvModeBtn").textContent = profile.skillAdvMode === "-" ? "-" : profile.skillAdvMode === "adv" ? "ADV" : "DIS";
  document.getElementById("statsGrid").innerHTML = ABILITIES.map(abil => `
    <div class="stat roll-row" data-roll-core="${abil}">
      <div class="stat-head">${abil}</div>
      <div class="stat-score">${scores[abil]}</div>
      <div class="stat-foot">
        <span class="stat-pair"><span class="muted">CHK</span><b>${fmtMod(abilityMod(scores[abil]))}</b></span>
        <span class="stat-pair save"><span class="muted">SAVE</span><b>${fmtMod(saveMod(abil, profile))}</b></span>
      </div>
    </div>
  `).join("");
  document.getElementById("skillsGrid").innerHTML = ["STR","DEX","INT","WIS","CHA"].map(abil => {
    const skills = SKILLS.filter(skill => skill.abil === abil).map(skill => {
      const prof = profileSkillProficiencies(profile).includes(skill.name);
      return `<div class="skill-line roll-row ${prof ? "prof" : ""}" data-roll-skill="${escapeAttr(skill.name)}"><span>${escapeHtml(skill.name)}</span><span>${fmtMod(skillMod(skill.name, profile))}</span></div>`;
    }).join("");
    return `<div class="skill-col"><div class="skill-col-title">${abil}</div>${skills}</div>`;
  }).join("");
  document.getElementById("passiveText").textContent = 10 + skillMod("Perception", profile);
  document.getElementById("spellDcText").textContent = spellDc(profile);
  const pact = spellcastingSummary(profile).pact;
  document.getElementById("pactSlotText").textContent = pact.slots ? `${pact.slots}xL${pact.level}` : "-";
  document.getElementById("hitDiceRows").innerHTML = Object.entries(profileHitDice(profile)).map(([die, max]) => {
    const current = Number(profile.hitDiceCur[die] ?? max);
    const pips = Array.from({ length:max }, (_, index) => `<span class="pip ${index < current ? "on green" : ""}" data-hit-die="${die}" data-hit-index="${index}"></span>`).join("");
    return `<div class="hitdice-row"><div class="hitdice-label">${die}</div><div class="pips-box">${pips}</div></div>`;
  }).join("") || `<div class="empty">No hit dice yet.</div>`;
  document.getElementById("derivedDetails").innerHTML = [
    { label:"Size", value:profileSize(profile) },
    { label:"Speed", value:`${profileSpeed(profile)} ft` },
    { label:"Armour Class", value:String(profileAc(profile)) },
    { label:"Initiative", value:fmtMod(profileInitiative(profile)) },
    { label:"Hit Points", value:`${profile.currentHp}/${computeHpMax(profile)}` },
    { label:"Hit Dice", value:Object.entries(profileHitDice(profile)).map(([die, count]) => `${count}${die}`).join(" + ") || "-" },
    { label:"Save Proficiencies", value:profileSaveProficiencies(profile).join(", ") || "-" },
    { label:"Skill Proficiencies", value:profileSkillProficiencies(profile).join(", ") || "-" },
    { label:"Tool Proficiencies", value:profileToolProficiencies(profile).join(", ") || "-" },
    { label:"Languages", value:profileLanguages(profile).join(", ") || "-" }
  ].map(item => `<div class="detail-item"><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value)}</div>`).join("");
}

function renderSlots(containerId){
  const profile = activeProfile();
  const summary = spellcastingSummary(profile);
  const host = document.getElementById(containerId);
  const labels = `<div class="slot-row">${Array.from({ length:9 }, (_, index) => `<div class="slot-label">${index + 1}</div>`).join("")}</div>`;
  const cells = Array.from({ length:9 }, (_, index) => {
    const level = index + 1;
    const max = summary.slots[level - 1] || 0;
    const cur = Number(profile.slotCur[level] ?? max);
    const pips = Array.from({ length:max }, (_, pipIndex) => `<span class="pip ${pipIndex < cur ? "on" : ""}" data-slot-level="${level}" data-slot-index="${pipIndex}"></span>`).join("");
    return `<div class="slot-cell">${pips || "-"}</div>`;
  }).join("");
  host.innerHTML = labels + `<div class="slot-row">${cells}</div>`;
  document.getElementById("slotHeadText").textContent = summary.pact.slots ? `Pact ${summary.pact.slots}xL${summary.pact.level}` : `Caster ${summary.casterLevel}`;
}

function buildAbilityButtons(profile = activeProfile()){
  const buttons = [];
  const counts = classCounts(profile);
  const warDomain = (counts.cleric || 0) >= 3 && hasSubclass(profile, "cleric:war");
  if ((counts.wizard || 0) >= 2 && hasSubclass(profile, "wizard:bladesinging")){
    buttons.push({
      id:"bladesong",
      label:profile.resources.bladesongActive ? "Bladesong On" : "Bladesong",
      note:`${Math.max(0, profBonus(profile) - profile.resources.bladesongUsed)}/${profBonus(profile)}`,
      infoText:"Activate Bladesong to add your Intelligence modifier to AC, improve concentration checks, and increase speed by 10 feet.",
      used:profile.resources.bladesongUsed,
      max:profBonus(profile),
      action:toggleBladesong
    });
  }
  if (profile.speciesSlug === "lineage:dragonborn"){
    buttons.push({
      id:"breath",
      label:"Breath Weapon",
      note:`${Math.max(0, 1 - profile.resources.breathWeaponUsed)}/1`,
      infoText:"Use your draconic breath weapon. Damage scales by level and refreshes on a long rest in this tracker.",
      used:profile.resources.breathWeaponUsed,
      max:1,
      action:useBreathWeapon
    });
  }
  if ((counts.cleric || 0) >= 2 || (counts.paladin || 0) >= 3){
    const uses = channelDivinityUsesMax(profile);
    const channelDivinityInfo = [
      "Channel Divinity: Divine Spark",
      "",
      "As a Magic action, you point your Holy Symbol at another creature you can see within 30 feet of yourself and focus divine energy at it. Roll 1d8 and add your Wisdom modifier. You either restore Hit Points to the creature equal to that total or force the creature to make a Constitution saving throw. On a failed save, the creature takes Necrotic or Radiant damage equal to that total. On a successful save, the creature takes half as much damage.",
      "",
      "You roll an additional d8 when you reach Cleric levels 7 (2d8), 13 (3d8), and 18 (4d8).",
      "",
      "Channel Divinity: Turn Undead",
      "",
      "As a Magic action, you present your Holy Symbol and censure Undead creatures. Each Undead of your choice within 30 feet of you must make a Wisdom saving throw. If the creature fails its save, it has the Frightened and Incapacitated conditions for 1 minute.",
      "",
      "For that duration, it tries to move as far from you as it can on its turns. This effect ends early on the creature if it takes any damage, if you have the Incapacitated condition, or if you die."
    ];
    if (warDomain){
      channelDivinityInfo.push(
        "",
        "War Domain: Guided Strike",
        "",
        "When you or a creature within 30 feet of you misses with an attack roll, you can expend one use of your Channel Divinity and give that roll a +10 bonus, potentially causing it to hit. If used on another creature's attack roll, this costs your Reaction."
      );
      if ((counts.cleric || 0) >= 6){
        channelDivinityInfo.push(
          "",
          "War Domain: War God's Blessing",
          "",
          "You can expend a use of Channel Divinity to cast Shield of Faith or Spiritual Weapon without expending a spell slot. When cast this way, the spell does not require Concentration, lasts for 1 minute, and ends early if you cast that spell again, gain the Incapacitated condition, or die."
        );
      }
    }
    buttons.push({
      id:"channel-divinity",
      label:"Channel Divinity",
      note:`${Math.max(0, uses - profile.resources.channelDivinityUsed)}/${uses}`,
      infoText:channelDivinityInfo.join("\n"),
      used:profile.resources.channelDivinityUsed,
      max:uses,
      action:useChannelDivinity
    });
  }
  if (warDomain){
    const wisUses = Math.max(1, abilityMod(finalAbilityScores(profile).WIS));
    buttons.push({
      id:"war-priest",
      label:"War Priest",
      note:`${Math.max(0, wisUses - profile.resources.warPriestUsed)}/${wisUses}`,
      infoText:"As a Bonus Action, you can make one attack with a weapon or an Unarmed Strike. You can use this Bonus Action a number of times equal to your Wisdom modifier (minimum of once). You regain all expended uses when you finish a Short or Long Rest.",
      showPips:true,
      used:profile.resources.warPriestUsed,
      max:wisUses,
      action:useWarPriest
    });
  }
  if (hasRingOfObscuring(profile)){
    buttons.push({
      id:"fog-cloud",
      label:"Fog Cloud",
      note:"Action",
      infoText:"Action. Expend 1 charge to cast Fog Cloud. The ring has 3 charges and regains 1d3 expended charges when you finish a Long Rest.",
      used:profile.resources.fogCloudUsed,
      max:3,
      action:useFogCloud
    });
  }
  if ((counts.warlock || 0) >= 1 && hasSubclass(profile, "warlock:hexblade")){
    buttons.push({
      id:"hexblade-curse",
      label:profile.resources.hexbladeCurseActive ? "Hexblade's Curse On" : "Hexblade's Curse",
      note:`${Math.max(0, 1 - profile.resources.hexbladeCurseUsed)}/1`,
      infoText:"Curse one target to gain bonus damage equal to proficiency bonus and score critical hits on 19-20 against it.",
      used:profile.resources.hexbladeCurseUsed,
      max:1,
      action:toggleHexbladeCurse
    });
  }
  if ((counts.rogue || 0) >= 3){
    buttons.push({
      id:"sneak-attack",
      label:profile.resources.sneakAttackReady ? "Sneak Attack On" : "Sneak Attack",
      note:sneakAttackDice(profile),
      infoText:sneakAttackInfoText(profile),
      showPips:false,
      action:toggleSneakAttack
    });
    buttons.push({
      id:"steady-aim",
      label:profile.resources.steadyAimActive ? "BA - Steady Aim On" : "BA - Steady Aim",
      note:"ADV",
      infoText:"As a Bonus Action, you give yourself Advantage on your next attack roll on your current turn. You can use this feature only if you haven't moved during this turn, and after you use it, your Speed is 0 until the end of the current turn.",
      showPips:false,
      action:toggleSteadyAim
    });
    buttons.push({
      id:"cunning-action",
      label:"BA - Cunning Action",
      note:"Dash / Disengage / Hide",
      infoText:"On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.",
      showPips:false,
      action:showCunningAction
    });
  }
  if ((counts.paladin || 0) >= 2){
    buttons.push({
      id:"smite",
      label:"Divine Smite",
      note:"Roll",
      infoText:"Spend a spell slot after a melee weapon hit to add radiant damage, with extra damage against fiends and undead.",
      used:0,
      max:0,
      action:rollDivineSmite
    });
  }
  if ((counts.barbarian || 0) >= 1){
    buttons.push({
      id:"rage",
      label:"Rage",
      note:"Track",
      infoText:"Toggle Rage tracking for damage resistance and bonus melee damage.",
      used:profile.resources.rageUsed ? 1 : 0,
      max:1,
      action:toggleRage
    });
  }
  return buttons;
}

function channelDivinityUsesMax(profile = activeProfile()){
  const cleric = classCounts(profile).cleric || 0;
  if (cleric >= 18) return 4;
  if (cleric >= 6) return 3;
  if (cleric >= 2) return 2;
  const paladin = classCounts(profile).paladin || 0;
  return paladin >= 3 ? 1 : 0;
}

function renderAbilityPips(used, max, showPips = true){
  if (!showPips) return `<div class="ability-empty"></div>`;
  if (!max) return `<div class="tag ability-note">-</div>`;
  return `<div class="ability-pips">${Array.from({ length:max }, (_, index) => `<span class="pip green ${index >= used ? "on" : ""}"></span>`).join("")}</div>`;
}

function sneakAttackDice(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  if (!rogue) return "-";
  return `${Math.ceil(rogue / 2)}d6`;
}

function sneakAttackDiceCount(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  return rogue ? Math.ceil(rogue / 2) : 0;
}

function rogueCunningStrikeLimit(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  return rogue >= 11 ? 2 : 1;
}

function cunningStrikeSaveDc(profile = activeProfile()){
  return 8 + abilityMod(finalAbilityScores(profile).DEX) + profBonus(profile);
}

function cunningStrikeEffectCatalog(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  const effects = [];
  if (rogue >= 5){
    effects.push(
      { id:"poison", label:"Poison", cost:1, save:"CON", text:"Target makes a Constitution saving throw or becomes Poisoned for 1 minute, repeating the save at the end of each turn. Requires a Poisoner's Kit on your person." },
      { id:"trip", label:"Trip", cost:1, save:"DEX", text:"If the target is Large or smaller, it makes a Dexterity saving throw or falls Prone." },
      { id:"withdraw", label:"Withdraw", cost:1, save:"", text:"Immediately after the attack, you move up to half your speed without provoking Opportunity Attacks." }
    );
  }
  if (rogue >= 14){
    effects.push(
      { id:"daze", label:"Daze", cost:2, save:"CON", text:"Target makes a Constitution saving throw or on its next turn it can do only one of: move, take an action, or take a Bonus Action." },
      { id:"knock-out", label:"Knockout", cost:6, save:"CON", text:"Target makes a Constitution saving throw or becomes Unconscious for 1 minute or until it takes damage, repeating the save at the end of each turn." },
      { id:"obscure", label:"Obscure", cost:3, save:"DEX", text:"Target makes a Dexterity saving throw or is Blinded until the end of its next turn." }
    );
  }
  return effects;
}

function selectedCunningStrikeEffects(profile = activeProfile()){
  const catalog = cunningStrikeEffectCatalog(profile);
  const allowed = new Set(catalog.map(effect => effect.id));
  const selected = (profile.resources.cunningStrikeEffects || []).filter(id => allowed.has(id));
  const limited = selected.slice(0, rogueCunningStrikeLimit(profile));
  if (limited.length !== (profile.resources.cunningStrikeEffects || []).length){
    profile.resources.cunningStrikeEffects = limited;
  }
  return limited.map(id => catalog.find(effect => effect.id === id)).filter(Boolean);
}

function sneakAttackInfoText(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  if (!rogue) return "Sneak Attack is unavailable without Rogue levels.";
  const lines = [
    "Once per turn you can deal an extra 1d6 damage to one creature you hit with an attack roll if you have Advantage on the roll and the attack uses a Finesse or a Ranged weapon. The extra damage's type is the same as the weapon's type.",
    "",
    "You don't need Advantage on the attack roll if at least one of your allies is within 5 feet of the target, the ally doesn't have the Incapacitated condition and you don't have Disadvantage on the attack roll."
  ];
  if (rogue >= 5){
    lines.push(
      "",
      "Level 5: Cunning Strike",
      "When you deal Sneak Attack damage, you can add one of the following Cunning Strike effects.",
      "Poison (Cost: 1d6). You add a toxin to your strike, forcing the target to make a Constitution saving throw. On a failed save, the target has the Poisoned condition for 1 minute. At the end of each of its turns, the poisoned target repeats the save, ending the effect on a success.",
      "",
      "To use this effect, you must have a Poisoner's Kit on your person.",
      "",
      "Trip (Cost: 1d6). If the target is Large or smaller, it must succeed on a Dexterity saving throw or have the Prone condition.",
      "",
      "Withdraw (Cost: 1d6). Immediately after the attack, you move up to half your speed without provoking Opportunity Attacks."
    );
  }
  if (rogue >= 11){
    lines.push(
      "",
      "Level 11: Improved Cunning Strike",
      "You can use up to two Cunning Strike effects when you deal Sneak Attack damage, paying the die cost for each effect."
    );
  }
  if (rogue >= 14){
    lines.push(
      "",
      "Level 14: Devious Strikes",
      "Daze (Cost: 2d6). The target must succeed on a Constitution saving throw, or on its next turn, it can do only one of the following: move or take an action or a Bonus Action.",
      "",
      "Knock Out (Cost: 6d6). The target must succeed on a Constitution saving throw, or it has the Unconscious condition for 1 minute or until it takes any damage. The Unconscious target repeats the save at the end of its turns, ending the effect on itself on a success.",
      "",
      "Obscure (Cost: 3d6). The target must succeed on a Dexterity saving throw, or it has the Blinded condition until the end of its next turn."
    );
  }
  return lines.join("\n");
}

function toggleCunningStrikeEffect(id){
  const profile = activeProfile();
  const selected = new Set(profile.resources.cunningStrikeEffects || []);
  if (selected.has(id)){
    selected.delete(id);
  }else{
    const next = Array.from(selected);
    if (next.length >= rogueCunningStrikeLimit(profile)){
      openResult("Cunning Strike", `You can select up to ${rogueCunningStrikeLimit(profile)} effect${rogueCunningStrikeLimit(profile) === 1 ? "" : "s"} at your current Rogue level.`);
      return;
    }
    selected.add(id);
  }
  profile.resources.cunningStrikeEffects = Array.from(selected);
  saveState();
}

function renderCombatPage(){
  const profile = activeProfile();
  document.getElementById("combatTop").innerHTML = `
    <div class="combat-chip"><span>HP</span><b>${profile.currentHp}/${computeHpMax(profile)}</b></div>
    <div class="combat-chip"><span>THP</span><b>${profile.thp}</b></div>
    <div class="combat-chip"><span>AC</span><b>${profileAc(profile)}</b></div>
    <div class="combat-chip"><span>Init</span><b>${fmtMod(profileInitiative(profile))}</b></div>
    <button class="action-btn blue" id="initRollBtn">INIT Roll</button>
  `;
  renderSlots("slotGrid");
  document.getElementById("concentrationModeBtn").textContent = profile.concentrationMode === "-" ? "Adv/Dis" : profile.concentrationMode.toUpperCase();
  document.getElementById("concentrationActiveBtn").textContent = "Concentration";
  document.getElementById("concentrationActiveBtn").className = `action-btn ${profile.concentrationActive ? "yellow" : "blue"}`;
  const buttons = buildAbilityButtons(profile);
  const byId = new Map(buttons.map(item => [item.id, item]));
  const sneakButton = byId.get("sneak-attack");
  const steadyAimButton = byId.get("steady-aim");
  const cunningActionButton = byId.get("cunning-action");
  const standardButtons = buttons.filter(item => !["sneak-attack", "steady-aim", "cunning-action"].includes(item.id));
  const rogue = classCounts(profile).rogue || 0;
  const cunningEffects = cunningStrikeEffectCatalog(profile);
  const selectedEffects = new Set((profile.resources.cunningStrikeEffects || []).filter(Boolean));
  const sneakMarkup = sneakButton ? `
    <div class="row-grid ability-row">
      <button class="icon-btn" data-ability-info="${sneakButton.id}">i</button>
      <button class="combat-action blue ${profile.resources.sneakAttackReady ? "ability-active" : ""}" data-ability-btn="${sneakButton.id}">
        <b>${escapeHtml(sneakButton.label)}</b>
        <span>${escapeHtml(sneakButton.note)}</span>
      </button>
      <div class="ability-pips-shell" style="display:grid;gap:4px;">
        ${cunningEffects.length ? `
          <div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:4px;">
            ${cunningEffects.slice(0, 3).map(effect => `<button class="small-btn ${selectedEffects.has(effect.id) ? "action-btn yellow" : ""}" data-cunning-effect="${effect.id}" style="padding:4px 6px;">${escapeHtml(effect.label)}</button>`).join("")}
          </div>
          ${rogue >= 14 ? `<div style="display:grid;grid-template-columns:repeat(3, minmax(0, 1fr));gap:4px;">${cunningEffects.slice(3).map(effect => `<button class="small-btn ${selectedEffects.has(effect.id) ? "action-btn yellow" : ""}" data-cunning-effect="${effect.id}" style="padding:4px 6px;">${escapeHtml(effect.label)}</button>`).join("")}</div>` : ""}
        ` : renderAbilityPips(0, 0, false)}
      </div>
    </div>
  ` : "";
  const bonusActionsMarkup = steadyAimButton || cunningActionButton ? `
    <div class="card" style="padding:6px;margin-top:6px;">
      <div class="card-title" style="margin-bottom:6px;"><span>Bonus Actions</span></div>
      <div class="grid-2">
        ${steadyAimButton ? `
          <div class="row-grid ability-row" style="grid-template-columns:auto 1fr;">
            <button class="icon-btn" data-ability-info="${steadyAimButton.id}">i</button>
            <button class="combat-action blue ${profile.resources.steadyAimActive ? "ability-active" : ""}" data-ability-btn="${steadyAimButton.id}">
              <b>${escapeHtml(steadyAimButton.label)}</b>
              <span>${escapeHtml(steadyAimButton.note)}</span>
            </button>
          </div>
        ` : ""}
        ${cunningActionButton ? `
          <div class="row-grid ability-row" style="grid-template-columns:auto 1fr;">
            <button class="icon-btn" data-ability-info="${cunningActionButton.id}">i</button>
            <button class="combat-action blue" data-ability-btn="${cunningActionButton.id}">
              <b>${escapeHtml(cunningActionButton.label)}</b>
              <span>${escapeHtml(cunningActionButton.note)}</span>
            </button>
          </div>
        ` : ""}
      </div>
    </div>
  ` : "";
  const tacticButtonsMarkup = rogue ? `
    <div class="card" style="padding:6px;margin-top:6px;">
      <div class="grid-2">
        <div class="row-grid ability-row" style="grid-template-columns:auto 1fr;">
          <button class="icon-btn" data-custom-info="sharpshooter">i</button>
          <button class="combat-action blue ${profile.resources.sharpshooterActive ? "ability-active" : ""}" data-custom-toggle="sharpshooter">
            <b>Sharpshooter</b>
            <span>${profile.resources.sharpshooterActive ? "-5 hit / +10 dmg" : "Ranged power shot"}</span>
          </button>
        </div>
        <div class="row-grid ability-row" style="grid-template-columns:auto 1fr;">
          <button class="icon-btn" data-custom-info="first-round-target">i</button>
          <button class="combat-action blue ${profile.resources.firstRoundTargetActive ? "ability-active" : ""}" data-custom-toggle="first-round-target">
            <b>First Round Target</b>
            <span>${profile.resources.firstRoundTargetActive ? "On" : "Off"}</span>
          </button>
        </div>
      </div>
    </div>
  ` : "";
  document.getElementById("abilityButtons").innerHTML = (sneakMarkup || standardButtons.length || bonusActionsMarkup || tacticButtonsMarkup)
    ? [
      sneakMarkup,
      ...standardButtons.map(item => `
        <div class="row-grid ability-row">
          <button class="icon-btn" data-ability-info="${item.id}">i</button>
          <button class="combat-action blue" data-ability-btn="${item.id}">
            <b>${escapeHtml(item.label)}</b>
            <span>${escapeHtml(item.note)}</span>
          </button>
          <div class="ability-pips-shell">${renderAbilityPips(item.used || 0, item.max || 0, item.showPips !== false)}</div>
        </div>
      `).join(""),
      bonusActionsMarkup,
      tacticButtonsMarkup
    ].join("")
    : `<div class="empty">No active buttons detected for this build yet.</div>`;
  renderWeaponRows();
  renderSpellRows();
  renderHistory();
}

function weaponAttackData(profile, weapon){
  const scores = finalAbilityScores(profile);
  const counts = classCounts(profile);
  let abilityKey = weapon.ability || "STR";
  if (weapon.finesse){
    abilityKey = abilityMod(scores.DEX) >= abilityMod(scores.STR) ? "DEX" : "STR";
  }
  if (weapon.type === "ranged") abilityKey = "DEX";
  if (weapon.type === "melee" && hasSubclass(profile, "warlock:hexblade") && (counts.warlock || 0) >= 1 && weapon.id.includes("battleaxe")){
    abilityKey = "CHA";
  }
  const attackBonus = profBonus(profile) + abilityMod(scores[abilityKey]) + Number(weapon.attackBonus || 0);
  const damageBonus = abilityMod(scores[abilityKey]) + Number(weapon.damageBonus || 0);
  return { abilityKey, attackBonus, damageBonus };
}

function renderWeaponRows(){
  const profile = activeProfile();
  const host = document.getElementById("weaponRows");
  const rows = profileWeapons(profile).map(weapon => {
    const mode = profile.attackModes[weapon.id] || { crit:false, adv:"-" };
    const data = weaponAttackData(profile, weapon);
    return `
      <div class="row-grid">
        <button class="icon-btn" data-weapon-info="${weapon.id}">i</button>
        <button class="combat-action" data-weapon-roll="${weapon.id}">
          <b>${escapeHtml(weapon.name)}</b>
          <span>${escapeHtml(weapon.damage)} ${escapeHtml(weapon.damageType || weapon.type)} / ${escapeHtml(data.abilityKey)} / to hit ${fmtMod(data.attackBonus)}</span>
        </button>
        <div class="tag">${fmtMod(data.attackBonus)}</div>
        <button class="mode-btn ${mode.crit ? "active" : "inactive"}" data-weapon-crit="${weapon.id}">Crit</button>
        <button class="mode-btn ${mode.adv !== "-" ? "active" : "inactive"}" data-weapon-adv="${weapon.id}">${mode.adv === "-" ? "Adv" : mode.adv.toUpperCase()}</button>
      </div>
    `;
  }).join("");
  host.innerHTML = rows || `<div class="empty">No weapons selected yet.</div>`;
}

function inferSpellMode(spell){
  const text = String(spell.description || "");
  if (/make a ranged spell attack|make a melee spell attack/i.test(text)) return "attack";
  if (/must succeed on a .* saving throw/i.test(text)) return "save";
  return "cast";
}

function renderSpellRows(){
  const profile = activeProfile();
  const host = document.getElementById("spellRows");
  const rows = currentSpellList(profile).map(spell => {
    const mode = profile.attackModes[spell.name] || { crit:false, adv:"-" };
    const hit = inferSpellMode(spell) === "attack" ? fmtMod(spellAttackMod(profile)) : inferSpellMode(spell) === "save" ? `DC ${spellDc(profile)}` : "-";
    return `
      <div class="row-grid">
        <button class="icon-btn" data-spell-info="${escapeHtml(spell.name)}">i</button>
        <button class="combat-action blue" data-spell-cast="${escapeHtml(spell.name)}">
          <b>${escapeHtml(spell.name)}</b>
          <span>L${spell.level} / ${escapeHtml(spell.school || "-")}</span>
        </button>
        <div class="tag">${escapeHtml(hit)}</div>
        <button class="mode-btn ${mode.crit ? "active" : "inactive"}" data-spell-crit="${escapeHtml(spell.name)}">${inferSpellMode(spell) === "attack" ? "Crit" : "-"}</button>
        <button class="mode-btn ${mode.adv !== "-" ? "active" : "inactive"}" data-spell-adv="${escapeHtml(spell.name)}">${mode.adv === "-" ? "Adv" : mode.adv.toUpperCase()}</button>
      </div>
    `;
  }).join("");
  host.innerHTML = rows || `<div class="empty">No spells selected. Use the Spells tab to add them.</div>`;
}

function renderEquipmentPage(){
  const profile = activeProfile();
  bindSelect("armorSelect", ARMORS, profile.equipment.armorId);
  bindSelect("shieldSelect", SHIELDS, profile.equipment.shieldId);
  bindSelect("cloakSelect", CLOAKS, profile.equipment.cloakId);
  bindSelect("ringSelect", RINGS, profile.equipment.ringId);
  bindSelect("weapon1Select", WEAPONS, profile.equipment.weaponIds[0]);
  bindSelect("weapon2Select", WEAPONS, profile.equipment.weaponIds[1]);
  bindSelect("weapon3Select", WEAPONS, profile.equipment.weaponIds[2]);
  const armor = armorById(profile.equipment.armorId);
  const shield = shieldById(profile.equipment.shieldId);
  const cloak = cloakById(profile.equipment.cloakId);
  const ring = ringById(profile.equipment.ringId);
  document.getElementById("equipmentSummary").innerHTML = [
    `${armor.name}${shield.ac ? ` + ${shield.name}` : ""}`,
    ...(cloak.id !== "none" ? [cloak.name] : []),
    ...(ring.id !== "none" ? [ring.name] : []),
    ...profileWeapons(profile).map(weapon => weapon.name)
  ].map(text => `<div class="detail-item">${escapeHtml(text)}</div>`).join("");
}

function bindSelect(id, items, selectedId){
  const select = document.getElementById(id);
  select.innerHTML = items.map(item => `<option value="${escapeHtml(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHtml(item.name)}</option>`).join("");
}

function renderSpellsPage(){
  const profile = activeProfile();
  const allKnown = unique([...(profile.knownSpells || []), ...extraSpellNames(profile, "known")]).map(getSpellByName).filter(Boolean).sort((a, b) => Number(a.level) - Number(b.level) || a.name.localeCompare(b.name));
  const prepared = unique([...(profile.preparedSpells || []), ...extraSpellNames(profile, "prepared")]).map(getSpellByName).filter(Boolean).sort((a, b) => Number(a.level) - Number(b.level) || a.name.localeCompare(b.name));
  renderSlots("spellbookSlotGrid");
  document.getElementById("spellbookSlotHeadText").textContent = document.getElementById("slotHeadText").textContent;
  document.getElementById("spellbookLimitsPanel").classList.toggle("collapsed", profile.spellbookLimitsCollapsed);
  document.getElementById("spellbookLimitsToggleText").textContent = profile.spellbookLimitsCollapsed ? "+" : "-";
  const counts = spellEditorCounts(profile);
  document.getElementById("spellCounts").innerHTML = `
    <div class="count-box">Known <b>${allKnown.length}</b></div>
    <div class="count-box ${counts.prepared > preparedSpellLimit(profile) ? "warn" : ""}">Prepared <b>${prepared.length}/${preparedSpellLimit(profile)}</b></div>
    <div class="count-box ${counts.spellbook > spellbookAllowance(profile) ? "warn" : ""}">Spellbook <b>${(profile.knownSpells || []).filter(name => Number(getSpellByName(name)?.level || 0) > 0).length}/${spellbookAllowance(profile) || "-"}</b></div>
    <div class="count-box">Spell DC <b>${spellDc(profile)}</b></div>
  `;
  document.getElementById("bonusSpellSummary").innerHTML = `Bonus spells <b>${extraSpellNames(profile, "known").length} known / ${extraSpellNames(profile, "prepared").length} prepared</b>`;
  document.getElementById("spellbookSubtabs").innerHTML = `
    <button class="book-subtab ${profile.spellbookView !== "edit" ? "active" : ""}" data-spellbook-view="book">Spellbook</button>
    <button class="book-subtab ${profile.spellbookView === "edit" ? "active" : ""}" data-spellbook-view="edit">Edit Spells</button>
  `;
  const showingEditor = profile.spellbookView === "edit";
  document.getElementById("spellbookMainView").style.display = showingEditor ? "none" : "";
  document.getElementById("spellbookEditorView").style.display = showingEditor ? "" : "none";
  const sections = [
    { title:"Prepared", list:prepared, prepared:true },
    { title:"Known", list:allKnown, prepared:false }
  ];
  document.getElementById("spellbookSummary").innerHTML = sections.map(section => `
    <div class="card">
      <div class="card-title"><span>${section.title} Spells</span></div>
      <div class="spellbook-list">
        ${section.list.length ? section.list.map(spell => `
          <div class="book-row ${section.prepared && (profile.preparedSpells || []).includes(spell.name) ? "prepared" : ""} ${(profile.extraSpells || []).some(item => item.name === spell.name) ? "extra" : ""}">
            <button class="icon-btn" data-spell-info="${escapeAttr(spell.name)}">i</button>
            <div>
              <div class="book-row-name">${escapeHtml(spell.name)}</div>
              <div class="book-row-meta">L${spell.level} / ${escapeHtml(spell.school || "-")} / ${escapeHtml(spell.classes || "-")}</div>
            </div>
            <button class="book-tag" data-toggle-known="${escapeAttr(spell.name)}">${(profile.knownSpells || []).includes(spell.name) ? "Known" : "Extra"}</button>
            <button class="book-tag" data-toggle-prepared="${escapeAttr(spell.name)}">${(profile.preparedSpells || []).includes(spell.name) || (profile.extraSpells || []).some(item => item.name === spell.name && item.prepared) ? "Prepared" : "Prep"}</button>
          </div>
        `).join("") : `<div class="empty">No ${section.title.toLowerCase()} spells yet.</div>`}
      </div>
    </div>
  `).join("");
  if (showingEditor){
    renderSpellEditorView();
  }else{
    document.getElementById("spellbookEditorView").innerHTML = "";
  }
}

function renderNotesPage(){
  document.getElementById("notesInput").value = activeProfile().notes || "";
}

function renderHistory(){
  const history = activeProfile().history || [];
  document.getElementById("historyBox").innerHTML = history.length
    ? history.map(line => `<div class="history-line">${escapeHtml(line)}</div>`).join("")
    : `<div class="history-line muted">No rolls yet.</div>`;
}

function render(){
  const profile = activeProfile();
  ensureProfileResources(profile);
  updateTopIdentity();
  renderProfileSelector();
  renderTabs();
  renderPages();
  renderBuilderPage();
  renderStatsPage();
  renderCombatPage();
  renderEquipmentPage();
  renderSpellsPage();
  renderNotesPage();
  bindGlobalButtons();
}

function ensureProfileResources(profile){
  if ((!profile.hpRolls || !profile.hpRolls.length) && currentLevel(profile) > 1){
    seedAverageProgression(profile);
  }
  const hpMax = computeHpMax(profile);
  profile.currentHp = clamp(parseNumberOrFallback(profile.currentHp, hpMax), 0, hpMax);
  const summary = spellcastingSummary(profile);
  for (let level = 1; level <= 9; level++){
    const max = summary.slots[level - 1] || 0;
    const cur = Number(profile.slotCur[level]);
    profile.slotCur[level] = max ? clamp(Number.isFinite(cur) ? cur : max, 0, max) : 0;
  }
  profile.pactSlotsCur = clamp(Number(profile.pactSlotsCur || summary.pact.slots), 0, summary.pact.slots);
  const maxHitDice = profileHitDice(profile);
  Object.entries(maxHitDice).forEach(([die, max]) => {
    profile.hitDiceCur[die] = clamp(Number(profile.hitDiceCur[die] ?? max), 0, max);
  });
}

function bindGlobalButtons(){
  document.getElementById("profileSelect").onchange = async event => {
    state.currentProfileId = event.target.value;
    await pullActiveProfile();
    saveState();
  };
  document.getElementById("duplicateProfileBtn").onclick = () => {
    const source = clone(activeProfile());
    source.id = `profile-${Date.now()}`;
    source.name = `${source.name} Copy`;
    source.autoSync = false;
    source.syncCode = "";
    state.profiles[source.id] = source;
    state.currentProfileId = source.id;
    saveState();
  };
  document.getElementById("createNewBtn").onclick = () => {
    const profile = createBlankProfile();
    state.profiles[profile.id] = profile;
    state.currentProfileId = profile.id;
    saveState();
  };
  document.getElementById("editTopBtn").onclick = openTopEditor;
  document.getElementById("builderNameInput").onchange = event => {
    activeProfile().name = event.target.value.trim() || "New Character";
    saveState();
  };
  document.getElementById("speciesSelectBtn").onclick = () => {
    selectionModal({
      title:"Select Species",
      items:speciesItems(),
      onSelect:slug => {
        activeProfile().speciesSlug = slug;
        maybePromptSpeciesAsi();
        saveState();
      }
    });
  };
  document.getElementById("backgroundSelectBtn").onclick = () => {
    selectionModal({
      title:"Select Background",
      items:backgroundItems(),
      onSelect:slug => {
        activeProfile().backgroundSlug = slug;
        activeProfile().backgroundSelections = { skills:[], tools:[], languages:[] };
        saveState();
      }
    });
  };
  document.getElementById("speciesInfoBtn").onclick = () => openEntryInfo(entryBySlug("lineages", activeProfile().speciesSlug));
  document.getElementById("backgroundInfoBtn").onclick = () => openEntryInfo(entryBySlug("backgrounds", activeProfile().backgroundSlug));
  document.querySelectorAll("[data-edit-background]").forEach(button => {
    button.onclick = () => openBackgroundChoiceEditor(button.dataset.editBackground);
  });
  document.querySelectorAll("[data-stat-minus]").forEach(button => button.onclick = () => adjustBaseStat(button.dataset.statMinus, -1));
  document.querySelectorAll("[data-stat-plus]").forEach(button => button.onclick = () => adjustBaseStat(button.dataset.statPlus, 1));
  document.querySelectorAll("[data-stat-mode]").forEach(button => button.onclick = () => toggleStatMode(button.dataset.statMode));
  document.getElementById("rollStatsBtn").onclick = openStatRoller;
  document.querySelectorAll("[data-level-class]").forEach(select => {
    select.onchange = event => {
      const index = Number(event.target.dataset.levelClass);
      const row = activeProfile().progression[index];
      row.classSlug = event.target.value;
      row.subclassSlug = "";
      row.asiMode = "";
      row.asiChoices = [];
      row.featSlug = "";
      row.expertiseChoices = [];
      autoFillProgression(index);
      saveState();
    };
  });
  document.querySelectorAll("[data-level-feature]").forEach(button => {
    button.onclick = () => openFeatureChooser(Number(button.dataset.levelFeature));
  });
  document.getElementById("targetLevelInput").onchange = event => {
    activeProfile().targetLevel = clamp(Number(event.target.value || 1), 1, 20);
    saveState();
  };
  document.getElementById("populateBuilderBtn").onclick = populateProfile;
  document.getElementById("levelUpBtn").onclick = levelUp;
  document.getElementById("repopulateBtn").onclick = populateProfile;
  document.getElementById("statsEditTopBtn").onclick = openTopEditor;
  document.getElementById("coinsBtn").onclick = openCoinsEditor;
  document.getElementById("coreRollTypeBtn").onclick = () => {
    activeProfile().coreRollType = activeProfile().coreRollType === "check" ? "save" : "check";
    saveState();
  };
  document.getElementById("coreAdvModeBtn").onclick = () => cycleMode("coreAdvMode");
  document.getElementById("skillAdvModeBtn").onclick = () => cycleMode("skillAdvMode");
  document.getElementById("editCoreBtn").onclick = () => openProficiencyEditor("save");
  document.getElementById("editSkillsBtn").onclick = () => openProficiencyEditor("skill");
  document.querySelectorAll("[data-roll-core]").forEach(button => {
    button.onclick = () => rollAbilityCheck(button.dataset.rollCore);
  });
  document.querySelectorAll("[data-roll-skill]").forEach(button => {
    button.onclick = () => rollSkillCheck(button.dataset.rollSkill);
  });
  document.querySelectorAll("[data-hit-die]").forEach(button => {
    button.onclick = () => spendHitDie(button.dataset.hitDie, Number(button.dataset.hitIndex));
  });
  document.getElementById("notesInput").onchange = event => {
    activeProfile().notes = event.target.value;
    saveState({ skipRender:true });
  };
  document.getElementById("armorSelect").onchange = event => {
    activeProfile().equipment.armorId = event.target.value;
    saveState();
  };
  document.getElementById("shieldSelect").onchange = event => {
    activeProfile().equipment.shieldId = event.target.value;
    saveState();
  };
  document.getElementById("cloakSelect").onchange = event => {
    activeProfile().equipment.cloakId = event.target.value;
    saveState();
  };
  document.getElementById("ringSelect").onchange = event => {
    activeProfile().equipment.ringId = event.target.value;
    saveState();
  };
  ["weapon1Select","weapon2Select","weapon3Select"].forEach((id, index) => {
    document.getElementById(id).onchange = event => {
      activeProfile().equipment.weaponIds[index] = event.target.value;
      saveState();
    };
  });
  document.getElementById("editSpellsBtn").onclick = () => {
    activeProfile().spellbookView = "edit";
    ensureSpellEditorDraft(activeProfile());
    render();
  };
  document.getElementById("exportSaveBtn").onclick = exportSave;
  document.getElementById("importSaveBtn").onclick = openImportModal;
  document.getElementById("syncStatusBtn").onclick = manualSyncNow;
  document.getElementById("initRollBtn").onclick = rollInitiative;
  document.getElementById("shortRestBtn").onclick = shortRest;
  document.getElementById("longRestBtn").onclick = longRest;
  document.getElementById("concentrationCheckBtn").textContent = "Con Check";
  document.getElementById("concentrationCheckBtn").onclick = runConcentrationCheck;
  document.getElementById("concentrationModeBtn").onclick = () => cycleMode("concentrationMode");
  document.getElementById("concentrationActiveBtn").onclick = () => toggleConcentration();
  document.getElementById("damageBtn").onclick = () => applyHpAction("damage");
  document.getElementById("healBtn").onclick = () => applyHpAction("heal");
  document.getElementById("thpBtn").onclick = () => applyHpAction("thp");
  document.getElementById("clearHistoryBtn").onclick = () => {
    activeProfile().history = [];
    saveState();
  };
  document.querySelectorAll("[data-slot-level]").forEach(pip => {
    pip.onclick = () => toggleSlot(Number(pip.dataset.slotLevel), Number(pip.dataset.slotIndex));
  });
  document.querySelectorAll("[data-ability-btn]").forEach(button => {
    const item = buildAbilityButtons().find(entry => entry.id === button.dataset.abilityBtn);
    if (item) button.onclick = item.action;
  });
  document.querySelectorAll("[data-ability-info]").forEach(button => {
    button.onclick = () => {
      const item = buildAbilityButtons().find(entry => entry.id === button.dataset.abilityInfo);
      if (item) openResult(item.label, item.infoText || item.note || "No details available.");
    };
  });
  document.querySelectorAll("[data-cunning-effect]").forEach(button => {
    button.onclick = () => toggleCunningStrikeEffect(button.dataset.cunningEffect);
  });
  document.querySelectorAll("[data-custom-toggle]").forEach(button => {
    button.onclick = () => {
      if (button.dataset.customToggle === "sharpshooter") toggleSharpshooter();
      if (button.dataset.customToggle === "first-round-target") toggleFirstRoundTarget();
    };
  });
  document.querySelectorAll("[data-custom-info]").forEach(button => {
    button.onclick = () => {
      if (button.dataset.customInfo === "sharpshooter"){
        openResult("Sharpshooter", "When active on this sheet, ranged weapon attacks take a -5 penalty to hit and gain +10 damage.");
      }
      if (button.dataset.customInfo === "first-round-target"){
        openResult("First Round Target", "During the first round of each combat, you have Advantage on attack rolls against any creature that hasn't taken a turn. If your Sneak Attack hits any target during that round, the target takes extra damage of the weapon's type equal to your Rogue level.");
      }
    };
  });
  document.querySelectorAll("[data-weapon-roll]").forEach(button => button.onclick = () => rollWeapon(button.dataset.weaponRoll));
  document.querySelectorAll("[data-weapon-info]").forEach(button => button.onclick = () => openResult(weaponById(button.dataset.weaponInfo).name, JSON.stringify(weaponById(button.dataset.weaponInfo), null, 2)));
  document.querySelectorAll("[data-weapon-crit]").forEach(button => button.onclick = () => toggleAttackMode(button.dataset.weaponCrit, "crit"));
  document.querySelectorAll("[data-weapon-adv]").forEach(button => button.onclick = () => toggleAttackMode(button.dataset.weaponAdv, "adv"));
  document.querySelectorAll("[data-spell-info]").forEach(button => {
    button.onclick = () => {
      const spell = getSpellByName(button.dataset.spellInfo);
      if (spell) openResult(spell.name, `${spell.description}\n\nRange: ${spell.range}\nCasting: ${spell.casting_time}\nDuration: ${spell.duration}`);
    };
  });
  document.querySelectorAll("[data-spell-cast]").forEach(button => button.onclick = () => castSpell(button.dataset.spellCast));
  document.querySelectorAll("[data-spell-crit]").forEach(button => button.onclick = () => toggleAttackMode(button.dataset.spellCrit, "crit"));
  document.querySelectorAll("[data-spell-adv]").forEach(button => button.onclick = () => toggleAttackMode(button.dataset.spellAdv, "adv"));
  document.querySelectorAll("[data-toggle-known]").forEach(button => button.onclick = () => toggleSpellKnown(button.dataset.toggleKnown));
  document.querySelectorAll("[data-toggle-prepared]").forEach(button => button.onclick = () => toggleSpellPrepared(button.dataset.togglePrepared));
  document.querySelectorAll("[data-spellbook-view]").forEach(button => {
    button.onclick = () => {
      activeProfile().spellbookView = button.dataset.spellbookView;
      if (activeProfile().spellbookView === "edit"){
        ensureSpellEditorDraft(activeProfile());
      }else{
        spellEditorDraft = null;
      }
      render();
    };
  });
  const toggleSpellbookLimitsBtn = document.getElementById("toggleSpellbookLimitsBtn");
  if (toggleSpellbookLimitsBtn){
    toggleSpellbookLimitsBtn.onclick = () => {
      activeProfile().spellbookLimitsCollapsed = !activeProfile().spellbookLimitsCollapsed;
      saveState();
    };
  }
  document.getElementById("editBonusSpellsBtn").onclick = openBonusSpellEditor;
  const importInput = document.getElementById("importSaveInput");
  importInput.onchange = event => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => importSaveText(String(reader.result || ""));
    reader.readAsText(file);
    importInput.value = "";
  };
}

function openTopEditor(){
  const profile = activeProfile();
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Edit Top Box</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>Name
        <input type="text" id="topNameInput" value="${escapeHtml(profile.name)}">
      </label>
      <label>Max HP
        <input type="number" id="topHpInput" value="${computeHpMax(profile)}">
      </label>
      <label>Base AC
        <input type="number" id="topBaseAcInput" value="${profile.customBaseAc == null ? profileBaseAc(profile) : profile.customBaseAc}">
      </label>
      <label>Init Bonus
        <input type="number" id="topInitInput" value="${Number(profile.initBonus || 0)}">
      </label>
      <label>Speed
        <input type="number" id="topSpeedInput" value="${profile.speedOverride == null ? profileSpeed(profile) : profile.speedOverride}">
      </label>
      <label>Proficiency Bonus
        <input type="number" id="topProfInput" value="${profBonus(profile)}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveTopBtn">Save</button>
    </div>
  `);
  document.getElementById("saveTopBtn").onclick = () => {
    const previousMaxHp = computeHpMax(profile);
    profile.name = document.getElementById("topNameInput").value.trim() || profile.name;
    profile.hpMaxOverride = parseNumberOrNull(document.getElementById("topHpInput").value);
    profile.customBaseAc = parseNumberOrNull(document.getElementById("topBaseAcInput").value);
    profile.initBonus = parseNumberOrFallback(document.getElementById("topInitInput").value, 0);
    profile.speedOverride = parseNumberOrNull(document.getElementById("topSpeedInput").value);
    profile.profOverride = parseNumberOrNull(document.getElementById("topProfInput").value);
    const nextMaxHp = computeHpMax(profile);
    profile.currentHp = profile.currentHp >= previousMaxHp ? nextMaxHp : clamp(profile.currentHp, 0, nextMaxHp);
    closeModal();
    saveState();
  };
}

function maybePromptSpeciesAsi(){
  const profile = activeProfile();
  const species = entryBySlug("lineages", profile.speciesSlug);
  if (!species) return;
  const text = String(species.raw_text || "");
  if (/increase one ability score by 2 and increase a different one by 1, or you increase three different scores by 1/i.test(text)){
    openSpeciesAsiModal();
    return;
  }
  if (profile.speciesSlug === "lineage:human"){
    profile.speciesAsiChoices = [{ ability:"STR", amount:1 }, { ability:"DEX", amount:1 }];
    return;
  }
  const fixedMatches = Array.from(text.matchAll(/your (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) score increases by (\d+)/gi));
  if (fixedMatches.length){
    profile.speciesAsiChoices = fixedMatches.map(match => ({ ability:match[1].slice(0, 3).toUpperCase(), amount:Number(match[2]) }));
  }
}

function openSpeciesAsiModal(){
  const profile = activeProfile();
  const current = profile.speciesAsiChoices.length ? profile.speciesAsiChoices : [
    { ability:"STR", amount:2 },
    { ability:"DEX", amount:1 }
  ];
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Species ASI</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>First bonus
        <select id="asiAbility1">
          ${ABILITIES.map(abil => `<option value="${abil}"${current[0]?.ability === abil ? " selected" : ""}>${abil}</option>`).join("")}
        </select>
      </label>
      <label>Amount
        <select id="asiAmount1">
          <option value="2"${Number(current[0]?.amount) === 2 ? " selected" : ""}>+2</option>
          <option value="1"${Number(current[0]?.amount) === 1 ? " selected" : ""}>+1</option>
        </select>
      </label>
      <label>Second bonus
        <select id="asiAbility2">
          ${ABILITIES.map(abil => `<option value="${abil}"${current[1]?.ability === abil ? " selected" : ""}>${abil}</option>`).join("")}
        </select>
      </label>
      <label>Amount
        <select id="asiAmount2">
          <option value="1"${Number(current[1]?.amount || 1) === 1 ? " selected" : ""}>+1</option>
          <option value="0">+0</option>
        </select>
      </label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveSpeciesAsiBtn">Save</button>
    </div>
  `);
  document.getElementById("saveSpeciesAsiBtn").onclick = () => {
    profile.speciesAsiChoices = [
      { ability:document.getElementById("asiAbility1").value, amount:Number(document.getElementById("asiAmount1").value) },
      { ability:document.getElementById("asiAbility2").value, amount:Number(document.getElementById("asiAmount2").value) }
    ].filter(item => item.amount > 0);
    closeModal();
    saveState();
  };
}

function adjustBaseStat(ability, delta){
  const profile = activeProfile();
  const key = profile.statMode === "manual" ? "manualBase" : "pointBuyBase";
  profile[key][ability] = clamp(Number(profile[key][ability] || 8) + delta, 3, 20);
  saveState();
}

function toggleStatMode(ability){
  const profile = activeProfile();
  profile.statMode = profile.statMode === "manual" ? "pointbuy" : "manual";
  saveState();
}

function openStatRoller(){
  const rolls = Array.from({ length:6 }, () => roll4d6DropLowest());
  const profile = activeProfile();
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Roll Stats</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="stack">
      ${rolls.map((roll, index) => `
        <div class="detail-item">
          <strong>Roll ${index + 1}:</strong> ${roll.rolls.join(", ")} -> drop ${roll.dropped.join(", ")} = ${roll.total}
          <div style="margin-top:6px;">
            <select data-roll-assign="${index}">
              <option value="">Assign stat</option>
              ${ABILITIES.map(abil => `<option value="${abil}">${abil}</option>`).join("")}
            </select>
          </div>
        </div>
      `).join("")}
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveRollsBtn">Use Rolls</button>
    </div>
  `);
  document.getElementById("saveRollsBtn").onclick = () => {
    const assigned = {};
    document.querySelectorAll("[data-roll-assign]").forEach(select => {
      if (select.value) assigned[select.value] = rolls[Number(select.dataset.rollAssign)].total;
    });
    if (Object.keys(assigned).length !== 6){
      openResult("Roll Stats", "Assign all six rolls before saving.");
      return;
    }
    profile.statMode = "manual";
    profile.statRolls = rolls;
    profile.manualBase = Object.assign({}, profile.manualBase, assigned);
    closeModal();
    saveState();
  };
}

function roll4d6DropLowest(){
  const rolls = Array.from({ length:4 }, () => Math.floor(Math.random() * 6) + 1);
  const sorted = rolls.slice().sort((a, b) => a - b);
  const dropped = [sorted[0]];
  const kept = sorted.slice(1);
  return { rolls, dropped, total:kept.reduce((sum, value) => sum + value, 0) };
}

function autoFillProgression(index){
  const profile = activeProfile();
  const row = profile.progression[index];
  if (!row.classSlug) return;
  for (let next = index + 1; next < 20; next++){
    if (!profile.progression[next].classSlug){
      profile.progression[next].classSlug = row.classSlug;
    }
  }
}

function openFeatureChooser(index){
  const profile = activeProfile();
  const row = profile.progression[index];
  if (!row.classSlug){
    openResult("Feature", "Choose a class first.");
    return;
  }
  const classLevel = progressionUpTo(profile, index + 1).filter(item => item.classSlug === row.classSlug).length;
  if (row.classSlug === "rogue" && (classLevel === 1 || classLevel === 6)){
    openExpertiseChooser(index);
    return;
  }
  const subclassLevel = CLASS_RULES[row.classSlug]?.subclassLevel || 99;
  if (classLevel === subclassLevel){
    selectionModal({
      title:`Select ${classLabel(row.classSlug)} Subclass`,
      items:subclassItemsForClass(row.classSlug),
      onSelect:slug => {
        row.subclassSlug = slug;
        saveState();
      }
    });
    return;
  }
  if ((CLASS_RULES[row.classSlug]?.asi || []).includes(classLevel)){
    openAsiOrFeatModal(index);
    return;
  }
  const text = findClassFeatureText(profile, index) || "No interactive choice for this level yet.";
  openResult(`Level ${index + 1}`, text);
}

function openExpertiseChooser(index){
  const profile = activeProfile();
  const row = profile.progression[index];
  const options = expertiseEligibleSkills(profile, index);
  const selected = new Set(row.expertiseChoices || []);
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Select Expertise</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="detail-box">Choose 2 proficient skills to gain double proficiency bonus.</div>
    <div class="list-grid" style="margin-top:8px;">
      ${options.map(option => `
        <label class="list-item">
          <input type="checkbox" data-expertise-skill="${escapeAttr(option)}" ${selected.has(option) ? "checked" : ""}>
          <div class="list-item-main"><div class="list-title">${escapeHtml(option)}</div></div>
        </label>
      `).join("")}
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveExpertiseBtn">Save</button>
    </div>
  `);
  document.getElementById("saveExpertiseBtn").onclick = () => {
    const picks = Array.from(document.querySelectorAll("[data-expertise-skill]:checked")).map(input => input.dataset.expertiseSkill);
    if (picks.length !== 2){
      openResult("Select Expertise", "Choose exactly 2 proficient skills.");
      return;
    }
    row.expertiseChoices = picks;
    closeModal();
    saveState();
  };
}

function openAsiOrFeatModal(index){
  const row = activeProfile().progression[index];
  openModal(`
    <div class="modal-head">
      <div class="modal-title">ASI or Feat</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="chooseAsiBtn">ASI</button>
      <button class="action-btn gold" id="chooseFeatBtn">Feat</button>
    </div>
  `);
  document.getElementById("chooseAsiBtn").onclick = () => openAsiDetailModal(index);
  document.getElementById("chooseFeatBtn").onclick = () => {
    closeModal();
    selectionModal({
      title:"Select Feat",
      items:featItems(),
      onSelect:slug => {
        row.asiMode = "feat";
        row.featSlug = slug;
        row.asiChoices = [];
        saveState();
      }
    });
  };
}

function openAsiDetailModal(index){
  const row = activeProfile().progression[index];
  const current = row.asiChoices?.length ? row.asiChoices : [{ ability:"STR", amount:2 }];
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Ability Score Improvement</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>First bonus
        <select id="asiPick1Ability">${ABILITIES.map(abil => `<option value="${abil}"${current[0]?.ability === abil ? " selected" : ""}>${abil}</option>`).join("")}</select>
      </label>
      <label>Amount
        <select id="asiPick1Amount">
          <option value="2"${Number(current[0]?.amount || 2) === 2 ? " selected" : ""}>+2</option>
          <option value="1"${Number(current[0]?.amount) === 1 ? " selected" : ""}>+1</option>
        </select>
      </label>
      <label>Second bonus
        <select id="asiPick2Ability">${ABILITIES.map(abil => `<option value="${abil}"${current[1]?.ability === abil ? " selected" : ""}>${abil}</option>`).join("")}</select>
      </label>
      <label>Amount
        <select id="asiPick2Amount">
          <option value="0"${!current[1] ? " selected" : ""}>+0</option>
          <option value="1"${Number(current[1]?.amount) === 1 ? " selected" : ""}>+1</option>
        </select>
      </label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveAsiChoicesBtn">Save</button>
    </div>
  `);
  document.getElementById("saveAsiChoicesBtn").onclick = () => {
    row.asiMode = "asi";
    row.featSlug = "";
    row.asiChoices = [
      { ability:document.getElementById("asiPick1Ability").value, amount:Number(document.getElementById("asiPick1Amount").value) },
      { ability:document.getElementById("asiPick2Ability").value, amount:Number(document.getElementById("asiPick2Amount").value) }
    ].filter(item => item.amount > 0);
    closeModal();
    saveState();
  };
}

function openBackgroundChoiceEditor(label){
  const profile = activeProfile();
  const backgroundData = parseBackgroundChoiceData(profile);
  const key = label.toLowerCase().includes("skill") ? "skills" : label.toLowerCase().includes("tool") ? "tools" : "languages";
  const options = key === "skills" ? backgroundData.skillOptions : key === "tools" ? backgroundData.toolOptions : backgroundData.languageOptions;
  const selected = new Set(profile.backgroundSelections[key] || []);
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Edit ${escapeHtml(label)}</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <div class="list-grid">
        ${options.map(option => `
          <label class="list-item">
            <input type="checkbox" data-background-choice="${escapeAttr(option)}" ${selected.has(option) ? "checked" : ""}>
            <div class="list-item-main"><div class="list-title">${escapeHtml(option)}</div></div>
          </label>
        `).join("")}
      </div>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveBackgroundChoicesBtn">Save</button>
    </div>
  `);
  document.getElementById("saveBackgroundChoicesBtn").onclick = () => {
    profile.backgroundSelections[key] = Array.from(document.querySelectorAll("[data-background-choice]:checked")).map(input => input.dataset.backgroundChoice);
    closeModal();
    saveState();
  };
}

function cycleMode(key){
  const profile = activeProfile();
  profile[key] = profile[key] === "-" ? "adv" : profile[key] === "adv" ? "dis" : "-";
  saveState();
}

function rollAbilityCheck(ability){
  const profile = activeProfile();
  const mode = profile.coreAdvMode;
  const roll = rollD20(mode);
  const bonus = profile.coreRollType === "save" ? saveMod(ability, profile) : abilityMod(finalAbilityScores(profile)[ability]);
  const label = `${ability} ${profile.coreRollType === "save" ? "Save" : "Check"}`;
  const text = `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${roll.chosen + bonus}`;
  openResult(label, text);
  pushHistory(`${label}: ${text}`);
}

function rollSkillCheck(skillName){
  const profile = activeProfile();
  const roll = rollD20(profile.skillAdvMode);
  const bonus = skillMod(skillName, profile);
  const reliableTalentActive = (classCounts(profile).rogue || 0) >= 7 && profileSkillProficiencies(profile).includes(skillName);
  const effectiveRoll = reliableTalentActive && roll.chosen < 10 ? 10 : roll.chosen;
  const text = `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${effectiveRoll} ${fmtMod(bonus)} = ${effectiveRoll + bonus}${reliableTalentActive && roll.chosen < 10 ? "\nReliable Talent" : ""}`;
  openResult(skillName, text);
  pushHistory(`${skillName}: ${text}`);
}

function spendHitDie(die, pipIndex){
  const profile = activeProfile();
  const max = profileHitDice(profile)[die] || 0;
  const current = Number(profile.hitDiceCur[die] ?? max);
  if (pipIndex >= current) return;
  const heal = rollDice(`1${die}`);
  const gain = heal.total + abilityMod(finalAbilityScores(profile).CON);
  profile.hitDiceCur[die] = Math.max(0, current - 1);
  profile.currentHp = clamp(profile.currentHp + Math.max(1, gain), 0, computeHpMax(profile));
  openResult(`Spend ${die}`, `${heal.rolls.join(" + ")} ${fmtMod(abilityMod(finalAbilityScores(profile).CON))} = ${gain}\nHP ${profile.currentHp}/${computeHpMax(profile)}`);
  pushHistory(`Spent ${die}: healed ${gain}.`);
  saveState();
}

function openCoinsEditor(){
  const profile = activeProfile();
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Coins</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>Copper<input type="number" id="coinsCp" value="${profile.coins.cp}"></label>
      <label>Silver<input type="number" id="coinsSp" value="${profile.coins.sp}"></label>
      <label>Gold<input type="number" id="coinsGp" value="${profile.coins.gp}"></label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveCoinsBtn">Save</button>
    </div>
  `);
  document.getElementById("saveCoinsBtn").onclick = () => {
    profile.coins.cp = Math.max(0, Number(document.getElementById("coinsCp").value || 0));
    profile.coins.sp = Math.max(0, Number(document.getElementById("coinsSp").value || 0));
    profile.coins.gp = Math.max(0, Number(document.getElementById("coinsGp").value || 0));
    closeModal();
    saveState();
  };
}

function openProficiencyEditor(kind){
  const profile = activeProfile();
  const key = kind === "save" ? "selectedSaves" : "selectedSkills";
  const all = kind === "save" ? ABILITIES : SKILLS.map(skill => skill.name);
  const selected = new Set(kind === "save" ? profileSaveProficiencies(profile) : profileSkillProficiencies(profile));
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Edit ${kind === "save" ? "Save" : "Skill"} Proficiencies</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="list-grid">
      ${all.map(option => `
        <label class="list-item">
          <input type="checkbox" data-prof-choice="${escapeAttr(option)}" ${selected.has(option) ? "checked" : ""}>
          <div class="list-item-main"><div class="list-title">${escapeHtml(option)}</div></div>
        </label>
      `).join("")}
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveProfEditBtn">Save</button>
    </div>
  `);
  document.getElementById("saveProfEditBtn").onclick = () => {
    profile[key] = Array.from(document.querySelectorAll("[data-prof-choice]:checked")).map(input => input.dataset.profChoice);
    closeModal();
    saveState();
  };
}

function toggleConcentration(name = ""){
  const profile = activeProfile();
  profile.concentrationActive = profile.concentrationActive ? "" : (name || "Concentration");
  saveState();
}

function runConcentrationCheck(){
  const profile = activeProfile();
  const bonus = saveMod("CON", profile) + (profile.resources.bladesongActive ? Math.max(1, abilityMod(finalAbilityScores(profile).INT)) : 0);
  const roll = rollD20(profile.concentrationMode);
  const total = roll.chosen + bonus;
  const failed = total < 10;
  let text = failed
    ? `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${total}\nFAIL`
    : `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${total}\nSAVE < ${total * 2} DMG`;
  if (failed && profile.concentrationActive){
    text += `\nConcentration broken: ${profile.concentrationActive}`;
    profile.concentrationActive = "";
  }
  openResult("Concentration Check", text);
  pushHistory(`Concentration: ${text.replace(/\n/g, " | ")}`);
  saveState();
}

function openQuickSpellEditor(index){
  selectionModal({
    title:`Quick Spell ${index + 1}`,
    items:spellItemsForProfile(),
    onSelect:slug => {
      activeProfile().quickSpells[index] = slug;
      saveState();
    }
  });
}

function castQuickSpell(index){
  const name = activeProfile().quickSpells[index];
  if (!name){
    openQuickSpellEditor(index);
    return;
  }
  castSpell(name);
}

function toggleSpellKnown(name){
  const profile = activeProfile();
  if ((profile.knownSpells || []).includes(name)){
    profile.knownSpells = profile.knownSpells.filter(item => item !== name);
    profile.preparedSpells = profile.preparedSpells.filter(item => item !== name);
  }else{
    profile.knownSpells.push(name);
  }
  saveState();
}

function toggleSpellPrepared(name){
  const profile = activeProfile();
  if ((profile.preparedSpells || []).includes(name)){
    profile.preparedSpells = profile.preparedSpells.filter(item => item !== name);
  }else{
    if (!(profile.knownSpells || []).includes(name)) profile.knownSpells.push(name);
    profile.preparedSpells.push(name);
  }
  saveState();
}

function openBonusSpellEditor(){
  const profile = activeProfile();
  const draft = Object.fromEntries((profile.extraSpells || []).map(item => [item.name, { known:item.known, prepared:item.prepared }]));
  const spells = (window.SPELL_DATA || []);
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Extra Spells</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="list-grid">
      ${spells.map(spell => {
        const flags = draft[spell.name] || { known:false, prepared:false };
        return `
          <div class="check-item">
            <button class="icon-btn" data-bonus-info="${escapeAttr(spell.name)}">i</button>
            <div class="list-item-main">
              <div class="list-title">${escapeHtml(spell.name)}</div>
              <div class="list-meta">L${spell.level} / ${escapeHtml(spell.school || "-")} / ${escapeHtml(spell.classes || "-")}</div>
            </div>
            <label class="class-pick"><span>K</span><input type="checkbox" data-bonus-known="${escapeAttr(spell.name)}" ${flags.known ? "checked" : ""}></label>
            <label class="class-pick"><span>P</span><input type="checkbox" data-bonus-prepared="${escapeAttr(spell.name)}" ${flags.prepared ? "checked" : ""}></label>
            <div></div>
          </div>
        `;
      }).join("")}
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveBonusSpellsBtn">Save</button>
    </div>
  `);
  document.querySelectorAll("[data-bonus-info]").forEach(button => button.onclick = () => {
    const spell = getSpellByName(button.dataset.bonusInfo);
    if (spell) openResult(spell.name, `${spell.description}\n\nRange: ${spell.range}\nCasting: ${spell.casting_time}\nDuration: ${spell.duration}`);
  });
  document.getElementById("saveBonusSpellsBtn").onclick = () => {
    const byName = {};
    document.querySelectorAll("[data-bonus-known]").forEach(box => {
      byName[box.dataset.bonusKnown] ||= { name:box.dataset.bonusKnown, known:false, prepared:false };
      byName[box.dataset.bonusKnown].known = box.checked;
    });
    document.querySelectorAll("[data-bonus-prepared]").forEach(box => {
      byName[box.dataset.bonusPrepared] ||= { name:box.dataset.bonusPrepared, known:false, prepared:false };
      byName[box.dataset.bonusPrepared].prepared = box.checked;
      if (box.checked) byName[box.dataset.bonusPrepared].known = true;
    });
    profile.extraSpells = Object.values(byName).filter(item => item.known || item.prepared);
    closeModal();
    saveState();
  };
}

function createSpellEditorDraft(profile = activeProfile()){
  return {
    known:new Set(profile.knownSpells || []),
    prepared:new Set(profile.preparedSpells || [])
  };
}

function ensureSpellEditorDraft(profile = activeProfile()){
  if (!spellEditorDraft){
    spellEditorDraft = createSpellEditorDraft(profile);
  }
  return spellEditorDraft;
}

function setDraftSpellKnown(name, checked){
  const draft = ensureSpellEditorDraft();
  if (checked){
    draft.known.add(name);
    return;
  }
  draft.known.delete(name);
  draft.prepared.delete(name);
}

function setDraftSpellPrepared(name, checked){
  const draft = ensureSpellEditorDraft();
  if (checked){
    draft.prepared.add(name);
    draft.known.add(name);
    return;
  }
  draft.prepared.delete(name);
}

function populateProfile(){
  const profile = activeProfile();
  profile.targetLevel = clamp(Number(document.getElementById("targetLevelInput").value || 1), 1, 20);
  const rows = progressionUpTo(profile);
  const scores = finalAbilityScores(profile);
  const conMod = abilityMod(scores.CON);
  profile.hpRolls = [];
  let hp = 0;
  rows.forEach((row, index) => {
    const hitDie = CLASS_RULES[row.classSlug]?.hitDie || 8;
    if (index === 0){
      hp += hitDie + conMod;
      return;
    }
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const safeAverage = Math.ceil(hitDie / 2);
    const chosen = Math.max(roll, safeAverage);
    profile.hpRolls.push({ level:index + 1, classSlug:row.classSlug, hitDie, roll, chosen });
    hp += chosen + conMod;
  });
  profile.currentHp = Math.max(1, hp);
  const summary = spellcastingSummary(profile);
  for (let level = 1; level <= 9; level++){
    profile.slotCur[level] = summary.slots[level - 1] || 0;
  }
  profile.pactSlotsCur = summary.pact.slots || 0;
  profile.hitDiceCur = profileHitDice(profile);
  profile.resources.bladesongUsed = 0;
  profile.resources.breathWeaponUsed = 0;
  profile.resources.channelDivinityUsed = 0;
  profile.resources.hexbladeCurseUsed = 0;
  profile.resources.hexbladeCurseActive = false;
  profile.resources.warPriestUsed = 0;
  profile.resources.sneakAttackReady = false;
  profile.resources.steadyAimActive = false;
  profile.concentrationActive = "";
  pushHistory(`Populated build to level ${profile.targetLevel}. HP max ${computeHpMax(profile)}.`);
  saveState();
}

function levelUp(){
  const profile = activeProfile();
  if (profile.targetLevel >= 20){
    openResult("Level Up", "Level 20 cap reached.");
    return;
  }
  const nextLevel = profile.targetLevel + 1;
  const row = profile.progression[nextLevel - 1];
  if (!row.classSlug){
    openResult("Level Up", `Choose a class for level ${nextLevel} in the Builder tab first.`);
    return;
  }
  profile.targetLevel = nextLevel;
  const scores = finalAbilityScores(profile);
  const conMod = abilityMod(scores.CON);
  const hitDie = CLASS_RULES[row.classSlug]?.hitDie || 8;
  const roll = Math.floor(Math.random() * hitDie) + 1;
  const chosen = Math.max(roll, Math.ceil(hitDie / 2));
  profile.hpRolls.push({ level:nextLevel, classSlug:row.classSlug, hitDie, roll, chosen });
  profile.currentHp = computeHpMax(profile);
  const summary = spellcastingSummary(profile);
  for (let level = 1; level <= 9; level++){
    const max = summary.slots[level - 1] || 0;
    profile.slotCur[level] = Math.max(profile.slotCur[level] || 0, max);
  }
  profile.pactSlotsCur = Math.max(profile.pactSlotsCur || 0, summary.pact.slots || 0);
  profile.hitDiceCur = profileHitDice(profile);
  pushHistory(`Level up to ${nextLevel}: ${row.classSlug} d${hitDie} roll ${roll}, chosen ${chosen}.`);
  saveState();
}

function exportSave(){
  const payload = { app:APP_ID, version:2, exportedAt:new Date().toISOString(), data:state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `jefferson-grug-2024-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  pushHistory("Exported save file.");
}

function openImportModal(){
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Import Save</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>Paste JSON
        <textarea id="importText"></textarea>
      </label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="importTextBtn">Import Pasted Save</button>
      <button class="action-btn gold" id="chooseImportFileBtn">Choose File</button>
    </div>
  `);
  document.getElementById("importTextBtn").onclick = () => importSaveText(document.getElementById("importText").value);
  document.getElementById("chooseImportFileBtn").onclick = () => document.getElementById("importSaveInput").click();
}

function importSaveText(text){
  try{
    const parsed = JSON.parse(text);
    state = normalizeGrugState(parsed.data ? parsed.data : parsed);
    closeModal();
    saveState();
  }catch(error){
    openResult("Import Failed", error?.message || "Could not import that save.");
  }
}

function applyHpAction(type){
  const profile = activeProfile();
  const amount = Math.max(0, Number(document.getElementById("amountInput").value || 0));
  document.getElementById("amountInput").value = "";
  if (!amount) return;
  if (type === "damage"){
    let remaining = amount;
    const absorbed = Math.min(profile.thp, remaining);
    if (absorbed){
      profile.thp -= absorbed;
      remaining -= absorbed;
    }
    profile.currentHp = clamp(profile.currentHp - remaining, 0, computeHpMax(profile));
    pushHistory(`Damage ${amount}: HP ${profile.currentHp}/${computeHpMax(profile)} THP ${profile.thp}`);
  }
  if (type === "heal"){
    profile.currentHp = clamp(profile.currentHp + amount, 0, computeHpMax(profile));
    pushHistory(`Heal ${amount}: HP ${profile.currentHp}/${computeHpMax(profile)}`);
  }
  if (type === "thp"){
    profile.thp = Math.max(profile.thp, amount);
    pushHistory(`THP now ${profile.thp}.`);
  }
  saveState();
}

function toggleSlot(level, pipIndex){
  const profile = activeProfile();
  const max = spellcastingSummary(profile).slots[level - 1] || 0;
  if (!max) return;
  const current = Number(profile.slotCur[level] || 0);
  profile.slotCur[level] = pipIndex < current ? pipIndex : Math.min(max, pipIndex + 1);
  saveState();
}

function toggleAttackMode(key, kind){
  const profile = activeProfile();
  profile.attackModes[key] ||= { crit:false, adv:"-" };
  if (kind === "crit"){
    profile.attackModes[key].crit = !profile.attackModes[key].crit;
  }else{
    profile.attackModes[key].adv = profile.attackModes[key].adv === "-" ? "adv" : profile.attackModes[key].adv === "adv" ? "dis" : "-";
    if (profile.attackModes[key].adv === "adv") activateSneakAttackFromAdvantageSource(profile);
  }
  saveState();
}

function rollD20(mode){
  const first = Math.floor(Math.random() * 20) + 1;
  if (mode === "adv" || mode === "dis"){
    const second = Math.floor(Math.random() * 20) + 1;
    const chosen = mode === "adv" ? Math.max(first, second) : Math.min(first, second);
    return { first, second, chosen };
  }
  return { first, chosen:first };
}

function rollDice(spec){
  const match = String(spec || "").match(/(\d+)d(\d+)/i);
  if (!match) return { rolls:[], total:0, max:0 };
  const count = Number(match[1]);
  const die = Number(match[2]);
  const rolls = Array.from({ length:count }, () => Math.floor(Math.random() * die) + 1);
  return { rolls, total:rolls.reduce((sum, value) => sum + value, 0), max:count * die };
}

function formatDiceFormula(spec, bonus = 0){
  const base = String(spec || "").toUpperCase();
  if (!bonus) return base;
  return `${base}${bonus > 0 ? `+${bonus}` : bonus}`;
}

function formatFormulaFromParts(base, parts){
  return [String(base || "").toUpperCase(), ...parts.filter(Boolean)].join("");
}

function formatSignedTerm(value){
  if (!value) return "";
  return value > 0 ? `+${value}` : `${value}`;
}

function formatChosenD20Roll(roll, mode){
  if (mode === "adv" || mode === "dis"){
    return `(${roll.first},${roll.second})`;
  }
  return String(roll.chosen);
}

function activateSneakAttackFromAdvantageSource(profile = activeProfile()){
  if ((classCounts(profile).rogue || 0) < 3) return;
  profile.resources.sneakAttackReady = true;
  profile.resources.sneakAttackDismissed = false;
}

function combinedAdvantageMode(baseMode, bonusAdvantage = false){
  if (!bonusAdvantage) return baseMode;
  if (baseMode === "dis") return "-";
  return "adv";
}

function rollWeapon(weaponId){
  const profile = activeProfile();
  const weapon = weaponById(weaponId);
  const mode = profile.attackModes[weaponId] || { crit:false, adv:"-" };
  const data = weaponAttackData(profile, weapon);
  const rogue = classCounts(profile).rogue || 0;
  const assassinFirstRound = profile.resources.firstRoundTargetActive && rogue >= 3 && hasSubclass(profile, "rogue:assassin");
  const hasBonusAdvantage = profile.resources.steadyAimActive || assassinFirstRound;
  const attackMode = combinedAdvantageMode(mode.adv, hasBonusAdvantage);
  const attack = rollD20(attackMode);
  const sharpshooterActive = profile.resources.sharpshooterActive && weapon.type === "ranged";
  const baseAttackBonus = data.attackBonus;
  const attackPenalty = sharpshooterActive ? -5 : 0;
  const attackBonus = baseAttackBonus + attackPenalty;
  const toHit = attack.chosen + attackBonus;
  const damage = rollDice(weapon.damage);
  const critFloor = profile.resources.hexbladeCurseActive ? 19 : 20;
  const crit = mode.crit || attack.chosen >= critFloor;
  const baseDamageBonus = data.damageBonus + (profile.resources.hexbladeCurseActive ? profBonus(profile) : 0);
  const sharpshooterDamageBonus = sharpshooterActive ? 10 : 0;
  const bonusDamage = baseDamageBonus + sharpshooterDamageBonus;
  let extra = "";
  let total = damage.total + bonusDamage + (crit ? damage.max : 0);
  if (profile.resources.sneakAttackReady && rogue > 0 && (weapon.type === "ranged" || weapon.finesse)){
    const selectedEffects = selectedCunningStrikeEffects(profile);
    const costTotal = selectedEffects.reduce((sum, effect) => sum + effect.cost, 0);
    const remainingDice = Math.max(0, sneakAttackDiceCount(profile) - costTotal);
    const sneak = remainingDice > 0 ? rollDice(`${remainingDice}d6`) : { rolls:[], total:0, max:0 };
    const sneakTotal = sneak.total + (crit ? sneak.max : 0);
    let effectLines = [];
    if (selectedEffects.length){
      const dc = cunningStrikeSaveDc(profile);
      effectLines = selectedEffects.map(effect => effect.save
        ? `${effect.label} (Cost ${effect.cost}d6): DC ${dc} ${effect.save} save`
        : `${effect.label} (Cost ${effect.cost}d6): no save`);
    }
    let firstRoundText = "";
    if (assassinFirstRound){
      total += rogue;
      firstRoundText = `\nAssassinate: +${rogue} first-round damage`;
    }
    total += sneakTotal;
    const sneakFormula = `${remainingDice}D6`;
    const sneakRollText = remainingDice > 0 ? `${sneak.rolls.join(" + ")}${crit ? ` + crit(${sneak.max})` : ""} = ${sneakTotal}` : `0 = ${sneakTotal}`;
    extra = `\nSneak Attack: ${sneakFormula} -> ${sneakRollText}${effectLines.length ? `\n${effectLines.join("\n")}` : ""}${firstRoundText}`;
    profile.resources.sneakAttackReady = false;
    profile.resources.sneakAttackDismissed = false;
    profile.resources.cunningStrikeEffects = [];
  }
  const attackFormula = formatFormulaFromParts("1d20", [formatSignedTerm(baseAttackBonus), formatSignedTerm(attackPenalty)]);
  const damageFormula = formatFormulaFromParts(weapon.damage, [formatSignedTerm(baseDamageBonus), formatSignedTerm(sharpshooterDamageBonus), crit ? `+crit(${damage.max})` : ""]);
  const attackRollText = `${formatChosenD20Roll(attack, attackMode)}${attackBonus ? `${fmtMod(attackBonus)}` : ""}`;
  const damageBreakdown = `${damage.total}${bonusDamage ? `${fmtMod(bonusDamage)}` : ""}${crit ? `+${damage.max}` : ""}`;
  const text = [
      `${weapon.name}`,
      `Attack: ${attackFormula} -> ${attackRollText} = ${toHit}`,
      `Damage: ${damageFormula} -> ${damageBreakdown} = ${damage.total + bonusDamage + (crit ? damage.max : 0)} ${weapon.damageType || weapon.type || ""}${extra}\nTotal Damage: ${total}`
    ].join("\n");
  openResult(weapon.name, text);
  pushHistory(text.replace(/\n/g, " | "));
  profile.resources.steadyAimActive = false;
  profile.resources.firstRoundTargetActive = false;
  saveState();
}

function spendSpellSlotForLevel(level){
  const profile = activeProfile();
  if (level <= 0) return true;
  for (let slot = level; slot <= 9; slot++){
    if ((profile.slotCur[slot] || 0) > 0){
      profile.slotCur[slot] -= 1;
      return { type:"slot", level:slot };
    }
  }
  const pact = spellcastingSummary(profile).pact;
  if (pact.slots && pact.level >= level && profile.pactSlotsCur > 0){
    profile.pactSlotsCur -= 1;
    return { type:"pact", level:pact.level };
  }
  return false;
}

function castSpell(name){
  const profile = activeProfile();
  const spell = getSpellByName(name);
  if (!spell){
    openResult("Spell", "Spell data not found.");
    return;
  }
  const mode = profile.attackModes[name] || { crit:false, adv:"-" };
  const actionType = inferSpellMode(spell);
  let text = `${spell.name}\n${spell.casting_time} / ${spell.range} / ${spell.duration}`;
  if (Number(spell.level || 0) > 0){
    const spent = spendSpellSlotForLevel(Number(spell.level || 0));
    if (!spent){
      openResult(spell.name, "No spell slots available.");
      return;
    }
    text += `\nSlot used: L${spent.level}${spent.type === "pact" ? " pact" : ""}`;
  }
  if (actionType === "attack"){
    const attack = rollD20(mode.adv);
    const toHit = attack.chosen + spellAttackMod(profile);
    text += `\nSpell attack: ${formatDiceFormula("1d20", spellAttackMod(profile))} -> ${attack.chosen}${fmtMod(spellAttackMod(profile))} = ${toHit}`;
  } else if (actionType === "save"){
    text += `\nSave DC ${spellDc(profile)}`;
  }
  const damageMatch = String(spell.description || "").match(/take(?:s)? (\d+d\d+) ([A-Za-z]+) damage/i);
  if (damageMatch){
    const damage = rollDice(damageMatch[1]);
    text += `\nDamage: ${String(damageMatch[1]).toUpperCase()} -> ${damage.rolls.join(" + ")} = ${damage.total} ${damageMatch[2]}`;
  }
  if (Boolean(spell.concentration) || /concentration/i.test(String(spell.duration || ""))){
    profile.concentrationActive = spell.name;
    text += `\nConcentration started: ${spell.name}`;
    if (String(spell.name || "").toLowerCase() === "shield of faith"){
      text += "\nAC +2 while concentration is active";
    }
  }
  openResult(spell.name, text);
  pushHistory(text.replace(/\n/g, " | "));
  saveState();
}

function rollInitiative(){
  const profile = activeProfile();
  const assassinAdvantage = (classCounts(profile).rogue || 0) >= 3 && hasSubclass(profile, "rogue:assassin");
  const roll = rollD20(assassinAdvantage ? "adv" : "-");
  const total = roll.chosen + profileInitiative(profile);
  let text = `${assassinAdvantage ? `d20 ${roll.first}, ${roll.second}` : `d20 ${roll.chosen}`}\nModifier ${fmtMod(profileInitiative(profile))}\nTotal ${total}`;
  if (assassinAdvantage) text += "\nAssassinate: Advantage on Initiative";
  openResult("Initiative", text);
  pushHistory(`Initiative ${total}`);
}

function toggleBladesong(){
  const profile = activeProfile();
  if (profile.resources.bladesongActive){
    profile.resources.bladesongActive = false;
    pushHistory("Bladesong deactivated.");
    saveState();
    return;
  }
  if (profile.resources.bladesongUsed >= profBonus(profile)){
    openResult("Bladesong", "No uses remaining until a long rest.");
    return;
  }
  profile.resources.bladesongUsed += 1;
  profile.resources.bladesongActive = true;
  openResult("Bladesong", `AC +${Math.max(1, abilityMod(finalAbilityScores(profile).INT))}\nSpeed +10 ft`);
  pushHistory("Bladesong activated.");
  saveState();
}

function useBreathWeapon(){
  const profile = activeProfile();
  if (profile.resources.breathWeaponUsed >= 1){
    openResult("Breath Weapon", "No uses remaining until a long rest.");
    return;
  }
  const level = currentLevel(profile);
  let dice = "2d10";
  if (level >= 17) dice = "5d10";
  else if (level >= 11) dice = "4d10";
  else if (level >= 6) dice = "3d10";
  const damage = rollDice(dice);
  profile.resources.breathWeaponUsed += 1;
  openResult("Breath Weapon", `${dice}: ${damage.rolls.join(" + ")} = ${damage.total}`);
  pushHistory(`Breath Weapon ${damage.total}`);
  saveState();
}

function useChannelDivinity(){
  const profile = activeProfile();
  const max = channelDivinityUsesMax(profile);
  if (profile.resources.channelDivinityUsed >= max){
    openResult("Channel Divinity", "No uses remaining until a short or long rest.");
    return;
  }
  profile.resources.channelDivinityUsed += 1;
  openResult("Channel Divinity", buildAbilityButtons(profile).find(item => item.id === "channel-divinity")?.infoText || "Use your chosen Channel Divinity option.");
  pushHistory("Channel Divinity used.");
  saveState();
}

function useWarPriest(){
  const profile = activeProfile();
  const uses = Math.max(1, abilityMod(finalAbilityScores(profile).WIS));
  if (profile.resources.warPriestUsed >= uses){
    openResult("War Priest", "No uses remaining until a short or long rest.");
    return;
  }
  profile.resources.warPriestUsed += 1;
  openResult("War Priest", "As a Bonus Action, you can make one attack with a weapon or an Unarmed Strike. You can use this Bonus Action a number of times equal to your Wisdom modifier (minimum of once). You regain all expended uses when you finish a Short or Long Rest.");
  pushHistory("War Priest used.");
  saveState();
}

function useFogCloud(){
  const profile = activeProfile();
  if (!hasRingOfObscuring(profile)){
    openResult("Fog Cloud", "Equip the Ring of Obscuring to use this ability.");
    return;
  }
  if (profile.resources.fogCloudUsed >= 3){
    openResult("Fog Cloud", "No charges remaining until a long rest.");
    return;
  }
  profile.resources.fogCloudUsed += 1;
  profile.concentrationActive = "Fog Cloud";
  openResult("Fog Cloud", "Action. Expend 1 charge to cast Fog Cloud.\nConcentration started: Fog Cloud");
  pushHistory("Fog Cloud cast from Ring of Obscuring.");
  saveState();
}

function toggleHexbladeCurse(){
  const profile = activeProfile();
  if (profile.resources.hexbladeCurseActive){
    profile.resources.hexbladeCurseActive = false;
    pushHistory("Hexblade's Curse ended.");
    saveState();
    return;
  }
  if (profile.resources.hexbladeCurseUsed >= 1){
    openResult("Hexblade's Curse", "No uses remaining until a short or long rest.");
    return;
  }
  profile.resources.hexbladeCurseUsed += 1;
  profile.resources.hexbladeCurseActive = true;
  openResult("Hexblade's Curse", `Bonus damage +${profBonus(profile)}. Crits on 19-20 against the cursed target.`);
  pushHistory("Hexblade's Curse activated.");
  saveState();
}

function toggleSteadyAim(){
  const profile = activeProfile();
  profile.resources.steadyAimActive = !profile.resources.steadyAimActive;
  if (profile.resources.steadyAimActive) activateSneakAttackFromAdvantageSource(profile);
  pushHistory(profile.resources.steadyAimActive ? "Steady Aim active for next attack." : "Steady Aim cleared.");
  saveState();
}

function showCunningAction(){
  openResult("BA - Cunning Action", "On your turn, you can take one of the following actions as a Bonus Action: Dash, Disengage, or Hide.");
}

function toggleSneakAttack(){
  const profile = activeProfile();
  profile.resources.sneakAttackReady = !profile.resources.sneakAttackReady;
  profile.resources.sneakAttackDismissed = !profile.resources.sneakAttackReady;
  pushHistory(profile.resources.sneakAttackReady ? "Sneak Attack primed." : "Sneak Attack cleared.");
  saveState();
}

function toggleSharpshooter(){
  const profile = activeProfile();
  profile.resources.sharpshooterActive = !profile.resources.sharpshooterActive;
  pushHistory(profile.resources.sharpshooterActive ? "Sharpshooter enabled." : "Sharpshooter cleared.");
  saveState();
}

function toggleFirstRoundTarget(){
  const profile = activeProfile();
  profile.resources.firstRoundTargetActive = !profile.resources.firstRoundTargetActive;
  if (profile.resources.firstRoundTargetActive) activateSneakAttackFromAdvantageSource(profile);
  pushHistory(profile.resources.firstRoundTargetActive ? "First Round Target marked." : "First Round Target cleared.");
  saveState();
}

function rollDivineSmite(){
  const spent = spendSpellSlotForLevel(1);
  if (!spent){
    openResult("Divine Smite", "No spell slots available for smite.");
    return;
  }
  const damage = rollDice("2d8");
  openResult("Divine Smite", `Slot used: L${spent.level}${spent.type === "pact" ? " pact" : ""}\n2d8 radiant: ${damage.rolls.join(" + ")} = ${damage.total}\nAdd 1d8 vs undead/fiends or for higher-level slots.`);
  pushHistory(`Divine Smite ${damage.total}`);
  saveState();
}

function toggleRage(){
  const profile = activeProfile();
  profile.resources.rageUsed = profile.resources.rageUsed ? 0 : 1;
  pushHistory(profile.resources.rageUsed ? "Rage activated." : "Rage cleared.");
  saveState();
}

function shortRest(){
  const profile = activeProfile();
  const summary = spellcastingSummary(profile);
  if ((classCounts(profile).cleric || 0) >= 2){
    profile.resources.channelDivinityUsed = Math.max(0, Math.min(channelDivinityUsesMax(profile), profile.resources.channelDivinityUsed) - 1);
  }else{
    profile.resources.channelDivinityUsed = 0;
  }
  profile.resources.hexbladeCurseUsed = 0;
  profile.resources.hexbladeCurseActive = false;
  profile.resources.warPriestUsed = 0;
  profile.resources.bladesongActive = false;
  profile.resources.steadyAimActive = false;
  profile.resources.sneakAttackReady = false;
  profile.resources.sneakAttackDismissed = false;
  profile.resources.firstRoundTargetActive = false;
  profile.concentrationActive = "";
  profile.pactSlotsCur = summary.pact.slots || 0;
  pushHistory("Short rest: pact slots and short-rest resources refreshed.");
  saveState();
}

function longRest(){
  const profile = activeProfile();
  const hpMax = computeHpMax(profile);
  profile.currentHp = hpMax;
  profile.thp = 0;
  const summary = spellcastingSummary(profile);
  for (let level = 1; level <= 9; level++){
    profile.slotCur[level] = summary.slots[level - 1] || 0;
  }
  profile.pactSlotsCur = summary.pact.slots || 0;
  profile.resources.bladesongUsed = 0;
  profile.resources.bladesongActive = false;
  profile.resources.breathWeaponUsed = 0;
  profile.resources.channelDivinityUsed = 0;
  profile.resources.hexbladeCurseUsed = 0;
  profile.resources.hexbladeCurseActive = false;
  profile.resources.warPriestUsed = 0;
  profile.resources.rageUsed = 0;
  profile.resources.steadyAimActive = false;
  profile.resources.sneakAttackReady = false;
  profile.resources.sneakAttackDismissed = false;
  profile.resources.firstRoundTargetActive = false;
  profile.concentrationActive = "";
  const fogRegain = rollDice("1d3").total;
  profile.resources.fogCloudUsed = Math.max(0, profile.resources.fogCloudUsed - fogRegain);
  Object.entries(profileHitDice(profile)).forEach(([die, max]) => {
    profile.hitDiceCur[die] = Math.min(max, (profile.hitDiceCur[die] || 0) + Math.max(1, Math.floor(max / 2)));
  });
  pushHistory(`Long rest: HP, slots, and long-rest resources refreshed.${hasRingOfObscuring(profile) ? ` Fog Cloud regained ${fogRegain} charge${fogRegain === 1 ? "" : "s"}.` : ""}`);
  saveState();
}

function renderSpellEditorView(options = {}){
  const profile = activeProfile();
  const host = document.getElementById("spellbookEditorView");
  const oldGrid = document.getElementById("spellEditorGrid");
  const previousScroll = oldGrid ? oldGrid.scrollTop : 0;
  const draft = ensureSpellEditorDraft(profile);
  const counts = spellEditorCounts(profile);
  const warnings = [];
  if (counts.prepared > preparedSpellLimit(profile)) warnings.push(`Prepared spells exceed the current limit (${counts.prepared}/${preparedSpellLimit(profile)}).`);
  if (counts.spellbook > spellbookAllowance(profile)) warnings.push(`Known leveled spells exceed the current spellbook limit (${counts.spellbook}/${spellbookAllowance(profile)}).`);
  const filters = profile.spellFilters;
  const query = filters.search.trim().toLowerCase();
  const minLevel = Math.min(filters.minLevel, filters.maxLevel);
  const maxLevel = Math.max(filters.minLevel, filters.maxLevel);
  const spells = (window.SPELL_DATA || []).filter(spell => {
    const level = Number(spell.level || 0);
    if (level < minLevel || level > maxLevel) return false;
    if (!spellMatchesClassFilter(spell, filters.class)) return false;
    if (query && !spellSearchText(spell).includes(query)) return false;
    return true;
  }).sort((a, b) => filters.sort === "az"
    ? a.name.localeCompare(b.name)
    : Number(a.level) - Number(b.level) || a.name.localeCompare(b.name));
  host.innerHTML = `
    <div class="book-section editor-shell">
      <div class="counts">
        <div class="count-box">Known <b>${counts.known}</b></div>
        <div class="count-box ${counts.prepared > preparedSpellLimit(profile) ? "warn" : ""}">Prepared <b>${counts.prepared}/${preparedSpellLimit(profile)}</b></div>
        <div class="count-box ${counts.spellbook > spellbookAllowance(profile) ? "warn" : ""}">Spellbook <b>${counts.spellbook}/${spellbookAllowance(profile) || "-"}</b></div>
        <div class="count-box">Matches <b>${spells.length}</b></div>
      </div>
      <div class="editor-note">Selections stay checked while you search and filter. They only change when you uncheck them or save.</div>
      ${warnings.map(text => `<div class="editor-warning">${escapeHtml(text)}</div>`).join("")}
      <div class="search-wrap">
        <input type="text" id="spellSearchInput" placeholder="Search all spell text, including ritual and concentration" value="${escapeAttr(filters.search)}">
        <button class="small-btn" id="spellSearchClear">X</button>
      </div>
      <div class="form-grid">
        <label>Class
          <select id="spellClassFilter">
            ${spellClassOptions(profile).map(option => `<option value="${option}"${filters.class === option ? " selected" : ""}>${escapeHtml(spellClassFilterLabel(option))}</option>`).join("")}
          </select>
        </label>
        <label>Sort
          <select id="spellSort">
            <option value="level"${filters.sort === "level" ? " selected" : ""}>Level</option>
            <option value="az"${filters.sort === "az" ? " selected" : ""}>A-Z</option>
          </select>
        </label>
      </div>
      <div class="grid-2">
        <label>Min Level
          <input type="number" id="spellMinLevel" min="0" max="9" value="${filters.minLevel}">
        </label>
        <label>Max Level
          <input type="number" id="spellMaxLevel" min="0" max="9" value="${filters.maxLevel}">
        </label>
      </div>
      <div class="editor-grid" id="spellEditorGrid">
        ${spells.map(spell => `
          <div class="check-item editor-row">
            <button class="icon-btn" data-editor-info="${escapeAttr(spell.name)}">i</button>
            <div class="editor-row-main">
              <div class="editor-row-title">${escapeHtml(spell.name)}</div>
              <div class="editor-row-meta">L${spell.level} / ${escapeHtml(spell.school || "-")} / ${escapeHtml(spell.classes || "-")}</div>
            </div>
            <div class="class-picks">
              <label class="class-pick">
                <span>K</span>
                <input type="checkbox" data-editor-known="${escapeAttr(spell.name)}" ${draft.known.has(spell.name) ? "checked" : ""}>
              </label>
              <label class="class-pick">
                <span>P</span>
                <input type="checkbox" data-editor-prepared="${escapeAttr(spell.name)}" ${draft.prepared.has(spell.name) ? "checked" : ""}>
              </label>
            </div>
          </div>
        `).join("") || `<div class="empty">No spells found.</div>`}
      </div>
      <div class="modal-actions">
        <button class="action-btn blue" id="saveSpellSelectionBtn">Save Spells</button>
        <button class="action-btn gold" id="cancelSpellSelectionBtn">Cancel</button>
      </div>
    </div>
  `;
  const newGrid = document.getElementById("spellEditorGrid");
  if (newGrid) newGrid.scrollTop = previousScroll;
  document.getElementById("spellSearchInput").oninput = event => {
    profile.spellFilters.search = event.target.value;
    renderSpellEditorView({ focusSearch:true, selectionStart:event.target.selectionStart, selectionEnd:event.target.selectionEnd });
  };
  document.getElementById("spellSearchClear").onclick = () => {
    profile.spellFilters.search = "";
    renderSpellEditorView({ focusSearch:true, selectionStart:0, selectionEnd:0 });
  };
  document.getElementById("spellClassFilter").onchange = event => {
    profile.spellFilters.class = event.target.value;
    renderSpellEditorView();
  };
  document.getElementById("spellSort").onchange = event => {
    profile.spellFilters.sort = event.target.value;
    renderSpellEditorView();
  };
  document.getElementById("spellMinLevel").oninput = event => {
    profile.spellFilters.minLevel = clamp(Number(event.target.value || 0), 0, 9);
    renderSpellEditorView();
  };
  document.getElementById("spellMaxLevel").oninput = event => {
    profile.spellFilters.maxLevel = clamp(Number(event.target.value || 9), 0, 9);
    renderSpellEditorView();
  };
  host.querySelectorAll("[data-editor-info]").forEach(button => {
    button.onclick = () => {
      const spell = getSpellByName(button.dataset.editorInfo);
      if (spell) openResult(spell.name, `${spell.description}\n\nRange: ${spell.range}\nCasting: ${spell.casting_time}\nDuration: ${spell.duration}`);
    };
  });
  host.querySelectorAll("[data-editor-known]").forEach(box => {
    box.onchange = () => {
      setDraftSpellKnown(box.dataset.editorKnown, box.checked);
      renderSpellEditorView();
    };
  });
  host.querySelectorAll("[data-editor-prepared]").forEach(box => {
    box.onchange = () => {
      setDraftSpellPrepared(box.dataset.editorPrepared, box.checked);
      renderSpellEditorView();
    };
  });
  document.getElementById("saveSpellSelectionBtn").onclick = () => {
    profile.knownSpells = Array.from(draft.known);
    profile.preparedSpells = Array.from(draft.prepared);
    profile.preparedSpells.forEach(name => {
      if (!profile.knownSpells.includes(name)) profile.knownSpells.push(name);
    });
    spellEditorDraft = null;
    profile.spellbookView = "book";
    saveState();
  };
  document.getElementById("cancelSpellSelectionBtn").onclick = () => {
    spellEditorDraft = null;
    profile.spellbookView = "book";
    render();
  };
  if (options.focusSearch){
    const search = document.getElementById("spellSearchInput");
    if (search){
      search.focus();
      const start = Number.isFinite(options.selectionStart) ? options.selectionStart : search.value.length;
      const end = Number.isFinite(options.selectionEnd) ? options.selectionEnd : start;
      search.setSelectionRange(start, end);
    }
  }
}

async function cloudSyncRequest(method, code, body = null){
  const response = await fetch(`/api/alaric-sync?code=${encodeURIComponent(code)}`, {
    method,
    headers: body ? { "Content-Type":"application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let json = null;
  try{ json = text ? JSON.parse(text) : null; }catch{}
  if (!response.ok){
    throw new Error((json && json.error) || text || `Sync failed (${response.status})`);
  }
  return json;
}

function exportProfilePayload(profile){
  return {
    app:APP_ID,
    version:2,
    exportedAt:new Date().toISOString(),
    data:{
      version:2,
      activePage:"stats",
      currentProfileId:"jefferson",
      profiles:{ jefferson:Object.assign({}, profile, { id:"jefferson", name:profile.name || "Jefferson Grug" }) },
      lastSyncByProfile:{}
    }
  };
}

function scheduleAutoSync(){
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    pushActiveProfile().catch(() => {});
  }, 900);
}

async function pushActiveProfile(){
  const profile = activeProfile();
  if (!profile.autoSync || !profile.syncCode) return;
  const payload = exportProfilePayload(profile);
  const result = await cloudSyncRequest("PUT", profile.syncCode, { payload, pin:AUTO_SYNC_PIN });
  state.lastSyncByProfile[profile.id] = result.updatedAt || new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function pullActiveProfile(){
  const profile = activeProfile();
  if (!profile.autoSync || !profile.syncCode || pullInFlight) return;
  pullInFlight = true;
  try{
    const result = await cloudSyncRequest("GET", profile.syncCode);
    const remote = result?.payload?.data?.profiles?.[profile.id];
    if (remote){
      state.profiles[profile.id] = ensureProfileShape(remote);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return;
    }
    await pushActiveProfile();
  }catch{
    await pushActiveProfile().catch(() => {});
  }finally{
    pullInFlight = false;
  }
}

async function manualSyncNow(){
  try{
    await pushActiveProfile();
    await pullActiveProfile();
    openResult("Sync", "Profile sync completed.");
    render();
  }catch(error){
    openResult("Sync", error?.message || "Sync failed.");
  }
}

window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try{
    state = normalizeGrugState(JSON.parse(event.newValue));
    render();
  }catch{}
});

document.getElementById("modalBack").onclick = event => {
  if (event.target.id === "modalBack") closeModal();
};

async function init(){
  await loadDb();
  state = loadState();
  await pullActiveProfile();
  render();
}

init().catch(error => {
  document.body.innerHTML = `<pre style="padding:16px;color:white;">${escapeHtml(error?.stack || String(error))}</pre>`;
});
