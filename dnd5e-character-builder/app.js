const STORAGE_KEY = "dnd5e_character_builder_v2";
const HISTORY_LIMIT = 100;
const AUTO_SYNC_PIN = "4242";
const TABS = [
  { id:"builder", label:"Builder" },
  { id:"stats", label:"Stats" },
  { id:"combat", label:"Combat" },
  { id:"equipment", label:"Equip" },
  { id:"spells", label:"Spells" },
  { id:"notes", label:"Notes" }
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
  cleric:{ name:"Cleric", hitDie:8, saves:["WIS","CHA"], subclassLevel:1, spellcasting:"full", spellAbility:"WIS", asi:[4,8,12,16,19] },
  druid:{ name:"Druid", hitDie:8, saves:["INT","WIS"], subclassLevel:2, spellcasting:"full", spellAbility:"WIS", asi:[4,8,12,16,19] },
  fighter:{ name:"Fighter", hitDie:10, saves:["STR","CON"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,6,8,12,14,16,19] },
  monk:{ name:"Monk", hitDie:8, saves:["STR","DEX"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,8,12,16,19] },
  paladin:{ name:"Paladin", hitDie:10, saves:["WIS","CHA"], subclassLevel:3, spellcasting:"half", spellAbility:"CHA", asi:[4,8,12,16,19] },
  ranger:{ name:"Ranger", hitDie:10, saves:["STR","DEX"], subclassLevel:3, spellcasting:"half", spellAbility:"WIS", asi:[4,8,12,16,19] },
  rogue:{ name:"Rogue", hitDie:8, saves:["DEX","INT"], subclassLevel:3, spellcasting:"none", spellAbility:"", asi:[4,8,10,12,16,19] },
  sorcerer:{ name:"Sorcerer", hitDie:6, saves:["CON","CHA"], subclassLevel:1, spellcasting:"full", spellAbility:"CHA", asi:[4,8,12,16,19] },
  warlock:{ name:"Warlock", hitDie:8, saves:["WIS","CHA"], subclassLevel:1, spellcasting:"warlock", spellAbility:"CHA", asi:[4,8,12,16,19] },
  wizard:{ name:"Wizard", hitDie:6, saves:["INT","WIS"], subclassLevel:2, spellcasting:"full", spellAbility:"INT", asi:[4,8,12,16,19] }
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
const WEAPONS = [
  { id:"none", name:"None", damage:"", ability:"" },
  { id:"hand-crossbow", name:"Hand Crossbow", damage:"1d6", damageType:"piercing", type:"ranged", ability:"DEX", range:"30/120", tags:["loading","light"] },
  { id:"battleaxe-plus-1", name:"+1 Battleaxe", damage:"1d8", damageType:"slashing", type:"melee", ability:"STR", attackBonus:1, damageBonus:1, versatile:"1d10", tags:["versatile"] },
  { id:"rapier-plus-1", name:"+1 Rapier", damage:"1d8", damageType:"piercing", type:"melee", ability:"DEX", finesse:true, attackBonus:1, damageBonus:1 },
  { id:"longbow-plus-1", name:"+1 Longbow", damage:"1d8", damageType:"piercing", type:"ranged", ability:"DEX", attackBonus:1, damageBonus:1, range:"150/600" },
  { id:"shortbow", name:"Shortbow", damage:"1d6", damageType:"piercing", type:"ranged", ability:"DEX", range:"80/320" }
];
const SAMPLE_SPELLS = {
  alaric:["Fire Bolt","Toll the Dead","Mage Hand","Guidance","Shield","Mage Armor","Misty Step","Haste","Fireball","Counterspell","Wall of Force"],
  wintio:["Eldritch Blast","Hex","Shield of Faith","Bless","Wrathful Smite","Misty Step"],
  jefferson:["Guidance","Toll the Dead","Bless","Shield of Faith"]
};

let db = { lineages:[], backgrounds:[], feats:[], classes:[], subclasses:[] };
let dbMaps = { lineages:new Map(), backgrounds:new Map(), feats:new Map(), classes:new Map(), subclasses:new Map() };
let state = null;
let saveTimer = null;
let pullInFlight = false;

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
    featSlug:""
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
    currentHp:1,
    thp:0,
    slotCur:{},
    pactSlotsCur:0,
    hitDiceCur:{},
    activePage:"builder",
    attackModes:{},
    history:[],
    equipment:{ armorId:"none", shieldId:"none", weaponIds:["none","none","none"] },
    knownSpells:[],
    preparedSpells:[],
    extraSpells:[],
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
      sneakAttackReady:false,
      steadyAimActive:false
    }
  };
}

function buildSampleProfiles(){
  const alaric = createBlankProfile("alaric");
  alaric.name = "Alaric";
  alaric.speciesSlug = "lineage:human";
  alaric.backgroundSlug = "background:haunted-one";
  alaric.targetLevel = 10;
  alaric.pointBuyBase = { STR:8, DEX:15, CON:15, INT:15, WIS:14, CHA:10 };
  alaric.manualBase = clone(alaric.pointBuyBase);
  alaric.speciesAsiChoices = [
    { ability:"INT", amount:1 },
    { ability:"DEX", amount:1 }
  ];
  alaric.progression.forEach((row, index) => {
    row.classSlug = index === 0 ? "cleric" : "wizard";
  });
  alaric.progression[0].subclassSlug = "cleric:war";
  alaric.progression[2].subclassSlug = "wizard:bladesinging";
  alaric.progression[4].asiMode = "feat";
  alaric.progression[4].featSlug = "feat:telekinetic";
  alaric.progression[8].asiMode = "feat";
  alaric.progression[8].featSlug = "feat:fey-touched";
  alaric.equipment = { armorId:"none", shieldId:"none", weaponIds:["hand-crossbow","none","none"] };
  alaric.knownSpells = SAMPLE_SPELLS.alaric.slice();
  alaric.preparedSpells = SAMPLE_SPELLS.alaric.slice();
  alaric.quickSpells = ["Shield","Misty Step","Haste","Fireball"];
  alaric.coins = { cp:42, sp:13, gp:7 };
  alaric.syncCode = "dnd5e-test-alaric";
  alaric.autoSync = true;

  const wintio = createBlankProfile("wintio");
  wintio.name = "Capt. Wintio";
  wintio.speciesSlug = "lineage:dragonborn";
  wintio.backgroundSlug = "background:sailor";
  wintio.targetLevel = 10;
  wintio.pointBuyBase = { STR:15, DEX:10, CON:14, INT:8, WIS:10, CHA:15 };
  wintio.manualBase = clone(wintio.pointBuyBase);
  wintio.speciesAsiChoices = [
    { ability:"STR", amount:2 },
    { ability:"CHA", amount:1 }
  ];
  wintio.progression.forEach((row, index) => {
    row.classSlug = index < 5 ? "paladin" : "warlock";
  });
  wintio.progression[2].subclassSlug = "paladin:glory";
  wintio.progression[5].subclassSlug = "warlock:hexblade";
  wintio.progression[3].asiMode = "asi";
  wintio.progression[3].asiChoices = [{ ability:"CHA", amount:2 }];
  wintio.progression[7].asiMode = "asi";
  wintio.progression[7].asiChoices = [{ ability:"STR", amount:2 }];
  wintio.equipment = { armorId:"half-plate", shieldId:"shield", weaponIds:["battleaxe-plus-1","none","none"] };
  wintio.knownSpells = SAMPLE_SPELLS.wintio.slice();
  wintio.preparedSpells = SAMPLE_SPELLS.wintio.slice();
  wintio.quickSpells = ["Hex","Bless","Shield of Faith","Wrathful Smite"];
  wintio.coins = { cp:0, sp:9, gp:48 };
  wintio.syncCode = "dnd5e-test-wintio";
  wintio.autoSync = true;

  const jefferson = createBlankProfile("jefferson");
  jefferson.name = "Jefferson Grug";
  jefferson.speciesSlug = "lineage:half-orc";
  jefferson.backgroundSlug = "background:mercenary-veteran";
  jefferson.targetLevel = 10;
  jefferson.pointBuyBase = { STR:10, DEX:15, CON:15, INT:8, WIS:14, CHA:8 };
  jefferson.manualBase = clone(jefferson.pointBuyBase);
  jefferson.speciesAsiChoices = [
    { ability:"STR", amount:2 },
    { ability:"CON", amount:1 }
  ];
  jefferson.progression.forEach((row, index) => {
    row.classSlug = index < 2 ? "cleric" : "rogue";
  });
  jefferson.progression[0].subclassSlug = "cleric:war";
  jefferson.progression[4].subclassSlug = "rogue:scout";
  jefferson.progression[5].asiMode = "asi";
  jefferson.progression[5].asiChoices = [{ ability:"DEX", amount:2 }];
  jefferson.progression[9].asiMode = "feat";
  jefferson.progression[9].featSlug = "feat:sharpshooter";
  jefferson.equipment = { armorId:"breastplate", shieldId:"none", weaponIds:["rapier-plus-1","longbow-plus-1","shortbow"] };
  jefferson.knownSpells = SAMPLE_SPELLS.jefferson.slice();
  jefferson.preparedSpells = SAMPLE_SPELLS.jefferson.slice();
  jefferson.quickSpells = ["Bless","Shield of Faith","Guidance","Toll the Dead"];
  jefferson.coins = { cp:5, sp:17, gp:24 };
  jefferson.syncCode = "dnd5e-test-jefferson";
  jefferson.autoSync = true;

  return { alaric, wintio, jefferson };
}

function createDefaultState(){
  return {
    version:1,
    activePage:"builder",
    currentProfileId:"alaric",
    profiles:buildSampleProfiles(),
    lastSyncByProfile:{}
  };
}

function loadState(){
  try{
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    const base = createDefaultState();
    if (!raw || typeof raw !== "object") return base;
    const merged = Object.assign(base, raw);
    merged.profiles = Object.assign(buildSampleProfiles(), raw.profiles || {});
    if (!merged.profiles[merged.currentProfileId]){
      merged.currentProfileId = Object.keys(merged.profiles)[0];
    }
    Object.keys(merged.profiles).forEach(profileId => {
      merged.profiles[profileId] = ensureProfileShape(merged.profiles[profileId]);
    });
    return merged;
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
  blank.backgroundSelections = Object.assign({}, blank.backgroundSelections, profile.backgroundSelections || {});
  blank.backgroundSelections.skills = unique(blank.backgroundSelections.skills || []);
  blank.backgroundSelections.tools = unique(blank.backgroundSelections.tools || []);
  blank.backgroundSelections.languages = unique(blank.backgroundSelections.languages || []);
  blank.equipment.weaponIds = Array.isArray(blank.equipment.weaponIds) ? blank.equipment.weaponIds.slice(0, 3) : ["none","none","none"];
  while (blank.equipment.weaponIds.length < 3) blank.equipment.weaponIds.push("none");
  blank.progression = Array.isArray(profile.progression) ? profile.progression.slice(0, 20) : blank.progression;
  while (blank.progression.length < 20){
    blank.progression.push({ classSlug:"", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"" });
  }
  blank.progression = blank.progression.map(row => Object.assign({ classSlug:"", subclassSlug:"", asiMode:"", asiChoices:[], featSlug:"" }, row));
  blank.knownSpells = unique(blank.knownSpells || blank.preparedSpells || []);
  blank.preparedSpells = unique(blank.preparedSpells || []);
  blank.selectedSkills = unique(blank.selectedSkills || []);
  blank.selectedSaves = unique(blank.selectedSaves || []);
  blank.extraSpells = Array.isArray(blank.extraSpells) ? blank.extraSpells.map(item => ({
    name:item?.name || "",
    known:item?.known !== false,
    prepared:Boolean(item?.prepared)
  })).filter(item => item.name) : [];
  blank.quickSpells = Array.isArray(blank.quickSpells) ? blank.quickSpells.slice(0, 4) : ["","","",""];
  while (blank.quickSpells.length < 4) blank.quickSpells.push("");
  blank.selectedFeats = Array.isArray(blank.selectedFeats) ? blank.selectedFeats : [];
  blank.history = Array.isArray(blank.history) ? blank.history.slice(0, HISTORY_LIMIT) : [];
  blank.statRolls = Array.isArray(blank.statRolls) ? blank.statRolls : [];
  blank.hpRolls = Array.isArray(blank.hpRolls) ? blank.hpRolls : [];
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
  return unique((profile.extraSpells || [])
    .filter(item => filter === "prepared" ? item.prepared : item.known)
    .map(item => item.name));
}

function profileSkillProficiencies(profile = activeProfile()){
  const skills = [];
  const backgroundData = parseBackgroundChoiceData(profile);
  skills.push(...backgroundData.fixedSkills, ...(profile.backgroundSelections.skills || []));
  const counts = classCounts(profile);
  Object.keys(counts).forEach(classSlug => {
    if (classSlug === "wizard") skills.push("Arcana", "History");
    if (classSlug === "cleric") skills.push("Insight", "Religion");
    if (classSlug === "rogue") skills.push("Stealth", "Perception");
    if (classSlug === "paladin") skills.push("Athletics", "Persuasion");
    if (classSlug === "warlock") skills.push("Deception", "Intimidation");
  });
  progressionUpTo(profile).forEach(row => {
    if (row.subclassSlug === "rogue:scout"){
      skills.push("Nature", "Survival");
    }
  });
  skills.push(...(profile.selectedSkills || []));
  return unique(skills);
}

function profileToolProficiencies(profile = activeProfile()){
  const backgroundData = parseBackgroundChoiceData(profile);
  return unique([...backgroundData.fixedTools, ...(profile.backgroundSelections.tools || [])]);
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
  const species = entryBySlug("lineages", profile.speciesSlug);
  const text = String((species && species.raw_text) || "");
  const match = text.match(/walking speed is (\d+)/i) || text.match(/base walking speed is (\d+)/i);
  let speed = match ? Number(match[1]) : 30;
  if (profile.resources.bladesongActive) speed += 10;
  const counts = classCounts(profile);
  if ((counts.rogue || 0) >= 9 && progressionUpTo(profile).some(row => row.subclassSlug === "rogue:scout")){
    speed += 10;
  }
  return speed;
}

function armorById(id){
  return ARMORS.find(item => item.id === id) || ARMORS[0];
}

function shieldById(id){
  return SHIELDS.find(item => item.id === id) || SHIELDS[0];
}

function weaponById(id){
  return WEAPONS.find(item => item.id === id) || WEAPONS[0];
}

function profileAc(profile = activeProfile()){
  const scores = finalAbilityScores(profile);
  const dexMod = abilityMod(scores.DEX);
  const armor = armorById(profile.equipment.armorId);
  const shield = shieldById(profile.equipment.shieldId);
  const dexContribution = armor.dexCap == null ? dexMod : Math.min(dexMod, armor.dexCap);
  let total = armor.base + dexContribution + shield.ac;
  const counts = classCounts(profile);
  if (profile.resources.bladesongActive && (counts.wizard || 0) >= 2 && progressionUpTo(profile).some(row => row.subclassSlug === "wizard:bladesinging")){
    total += Math.max(1, abilityMod(scores.INT));
  }
  if (profile.resources.hexbladeCurseActive) total += 0;
  return total;
}

function profileInitiative(profile = activeProfile()){
  return abilityMod(finalAbilityScores(profile).DEX);
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

function computeHpMax(profile = activeProfile()){
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
  return abilityMod(scores[skill.abil]) + (profileSkillProficiencies(profile).includes(skillName) ? profBonus(profile) : 0);
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
  const classEntry = entryBySlug("classes", row.classSlug);
  if (!classEntry) return "";
  const target = String(ordinal(classLevel)).toLowerCase();
  const mechanic = (classEntry.mechanics || []).find(item => String(item.text || "").toLowerCase().includes(target));
  return mechanic ? mechanic.section : "";
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
  const mechanics = (entry.mechanics || []).slice(0, 16).map(item => `[${item.section}] ${item.text}`).join("\n\n");
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
          ${Object.keys(CLASS_RULES).map(classSlug => `<option value="${classSlug}"${row.classSlug === classSlug ? " selected" : ""}>${CLASS_RULES[classSlug].name}</option>`).join("")}
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
  document.getElementById("coreRollTypeBtn").textContent = profile.coreRollType === "save" ? "Save" : "Check";
  document.getElementById("coreAdvModeBtn").textContent = profile.coreAdvMode === "-" ? "Adv/Dis" : profile.coreAdvMode.toUpperCase();
  document.getElementById("skillAdvModeBtn").textContent = profile.skillAdvMode === "-" ? "Adv/Dis" : profile.skillAdvMode.toUpperCase();
  document.getElementById("statsGrid").innerHTML = ABILITIES.map(abil => `
    <div class="stat roll-row" data-roll-core="${abil}">
      <div class="stat-head">${abil}</div>
      <div class="stat-score">${scores[abil]}</div>
      <div class="stat-foot">
        <span class="stat-pair"><span class="muted">CHK</span><b>${fmtMod(abilityMod(scores[abil]))}</b></span>
        <span class="stat-pair"><span class="muted">SAVE</span><b>${fmtMod(saveMod(abil, profile))}</b></span>
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
  if ((counts.wizard || 0) >= 2 && hasSubclass(profile, "wizard:bladesinging")){
    buttons.push({
      id:"bladesong",
      label:profile.resources.bladesongActive ? "Bladesong On" : "Bladesong",
      note:`${Math.max(0, profBonus(profile) - profile.resources.bladesongUsed)}/${profBonus(profile)}`,
      action:toggleBladesong
    });
  }
  if (profile.speciesSlug === "lineage:dragonborn"){
    buttons.push({
      id:"breath",
      label:"Breath Weapon",
      note:`${Math.max(0, 1 - profile.resources.breathWeaponUsed)}/1`,
      action:useBreathWeapon
    });
  }
  if ((counts.cleric || 0) >= 2 || (counts.paladin || 0) >= 3){
    const uses = 1;
    buttons.push({
      id:"channel-divinity",
      label:"Channel Divinity",
      note:`${Math.max(0, uses - profile.resources.channelDivinityUsed)}/${uses}`,
      action:useChannelDivinity
    });
  }
  if ((counts.cleric || 0) >= 1 && hasSubclass(profile, "cleric:war")){
    const wisUses = Math.max(1, abilityMod(finalAbilityScores(profile).WIS));
    buttons.push({
      id:"war-priest",
      label:"War Priest",
      note:`${Math.max(0, wisUses - profile.resources.warPriestUsed)}/${wisUses}`,
      action:useWarPriest
    });
  }
  if ((counts.warlock || 0) >= 1 && hasSubclass(profile, "warlock:hexblade")){
    buttons.push({
      id:"hexblade-curse",
      label:profile.resources.hexbladeCurseActive ? "Hexblade's Curse On" : "Hexblade's Curse",
      note:`${Math.max(0, 1 - profile.resources.hexbladeCurseUsed)}/1`,
      action:toggleHexbladeCurse
    });
  }
  if ((counts.rogue || 0) >= 1){
    buttons.push({
      id:"steady-aim",
      label:profile.resources.steadyAimActive ? "Steady Aim On" : "Steady Aim",
      note:"Toggle ADV",
      action:toggleSteadyAim
    });
    buttons.push({
      id:"sneak-attack",
      label:profile.resources.sneakAttackReady ? "Sneak Attack On" : "Sneak Attack",
      note:sneakAttackDice(profile),
      action:toggleSneakAttack
    });
  }
  if ((counts.paladin || 0) >= 2){
    buttons.push({
      id:"smite",
      label:"Divine Smite",
      note:"Roll",
      action:rollDivineSmite
    });
  }
  if ((counts.barbarian || 0) >= 1){
    buttons.push({
      id:"rage",
      label:"Rage",
      note:"Track",
      action:toggleRage
    });
  }
  return buttons;
}

function sneakAttackDice(profile = activeProfile()){
  const rogue = classCounts(profile).rogue || 0;
  if (!rogue) return "-";
  return `${Math.ceil(rogue / 2)}d6`;
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
  document.getElementById("concentrationActiveBtn").textContent = profile.concentrationActive || "Concentration Off";
  document.getElementById("concentrationActiveBtn").className = `action-btn ${profile.concentrationActive ? "yellow" : "blue"}`;
  document.getElementById("quickSpellRow").innerHTML = profile.quickSpells.map((name, index) => `
    <button class="mode-btn ${name ? "active" : "inactive"}" data-quick-spell="${index}">${escapeHtml(name || "-")}</button>
  `).join("");
  const buttons = buildAbilityButtons(profile);
  document.getElementById("abilityButtons").innerHTML = buttons.length
    ? buttons.map(item => `<button class="action-btn ${item.id === "steady-aim" && profile.resources.steadyAimActive ? "yellow" : item.id === "sneak-attack" && profile.resources.sneakAttackReady ? "yellow" : "blue"}" data-ability-btn="${item.id}">${escapeHtml(item.label)}<br><span class="tiny">${escapeHtml(item.note)}</span></button>`).join("")
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
  bindSelect("weapon1Select", WEAPONS, profile.equipment.weaponIds[0]);
  bindSelect("weapon2Select", WEAPONS, profile.equipment.weaponIds[1]);
  bindSelect("weapon3Select", WEAPONS, profile.equipment.weaponIds[2]);
  const armor = armorById(profile.equipment.armorId);
  const shield = shieldById(profile.equipment.shieldId);
  document.getElementById("equipmentSummary").innerHTML = [
    `${armor.name}${shield.ac ? ` + ${shield.name}` : ""}`,
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
  document.getElementById("spellCounts").innerHTML = `
    <div class="count-box">Known <b>${allKnown.length}</b></div>
    <div class="count-box">Prepared <b>${prepared.length}/${preparedSpellLimit(profile)}</b></div>
    <div class="count-box">Spellbook <b>${(profile.knownSpells || []).filter(name => Number(getSpellByName(name)?.level || 0) > 0).length}/${spellbookAllowance(profile) || "-"}</b></div>
    <div class="count-box">Spell DC <b>${spellDc(profile)}</b></div>
  `;
  document.getElementById("bonusSpellSummary").textContent = `${extraSpellNames(profile, "known").length} known / ${extraSpellNames(profile, "prepared").length} prepared`;
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
  profile.currentHp = clamp(Number(profile.currentHp || hpMax), 0, hpMax);
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
  ["weapon1Select","weapon2Select","weapon3Select"].forEach((id, index) => {
    document.getElementById(id).onchange = event => {
      activeProfile().equipment.weaponIds[index] = event.target.value;
      saveState();
    };
  });
  document.getElementById("editSpellsBtn").onclick = openSpellSelector;
  document.getElementById("exportSaveBtn").onclick = exportSave;
  document.getElementById("importSaveBtn").onclick = openImportModal;
  document.getElementById("syncStatusBtn").onclick = manualSyncNow;
  document.getElementById("initRollBtn").onclick = rollInitiative;
  document.getElementById("shortRestBtn").onclick = shortRest;
  document.getElementById("longRestBtn").onclick = longRest;
  document.getElementById("concentrationCheckBtn").onclick = runConcentrationCheck;
  document.getElementById("concentrationModeBtn").onclick = () => cycleMode("concentrationMode");
  document.getElementById("concentrationActiveBtn").onclick = () => toggleConcentration();
  document.querySelectorAll("[data-quick-spell]").forEach(button => {
    const index = Number(button.dataset.quickSpell);
    let pressTimer = null;
    button.onclick = () => castQuickSpell(index);
    button.oncontextmenu = event => {
      event.preventDefault();
      openQuickSpellEditor(index);
    };
    button.ontouchstart = () => {
      pressTimer = setTimeout(() => openQuickSpellEditor(index), 550);
    };
    button.ontouchend = () => clearTimeout(pressTimer);
  });
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
      <div class="modal-title">Edit Profile</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <label>Name
        <input type="text" id="topNameInput" value="${escapeHtml(profile.name)}">
      </label>
      <label>Portrait URL
        <input type="text" id="topPortraitInput" value="${escapeHtml(profile.portrait || "./alaric-headshot.png")}">
      </label>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveTopBtn">Save</button>
    </div>
  `);
  document.getElementById("saveTopBtn").onclick = () => {
    profile.name = document.getElementById("topNameInput").value.trim() || profile.name;
    profile.portrait = document.getElementById("topPortraitInput").value.trim() || "./alaric-headshot.png";
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
  const text = `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${roll.chosen + bonus}`;
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
  profile.concentrationActive = profile.concentrationActive ? "" : (name || "Custom");
  saveState();
}

function runConcentrationCheck(){
  const profile = activeProfile();
  const bonus = saveMod("CON", profile) + (profile.resources.bladesongActive ? Math.max(1, abilityMod(finalAbilityScores(profile).INT)) : 0);
  const roll = rollD20(profile.concentrationMode);
  const total = roll.chosen + bonus;
  const text = total >= 10 ? `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${total}\nSAVE < ${total * 2} DMG` : `${roll.second ? `${roll.first}, ${roll.second}` : roll.first} -> ${roll.chosen} ${fmtMod(bonus)} = ${total}\nFAIL`;
  openResult("Concentration Check", text);
  pushHistory(`Concentration: ${text.replace(/\n/g, " | ")}`);
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
  const payload = { app:"dnd5e-character-builder", version:2, exportedAt:new Date().toISOString(), data:state };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dnd5e-builder-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
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
    state = parsed.data ? parsed.data : parsed;
    if (!state.profiles) throw new Error("Missing profiles.");
    Object.keys(state.profiles).forEach(profileId => {
      state.profiles[profileId] = ensureProfileShape(state.profiles[profileId]);
    });
    if (!state.currentProfileId || !state.profiles[state.currentProfileId]){
      state.currentProfileId = Object.keys(state.profiles)[0];
    }
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

function rollWeapon(weaponId){
  const profile = activeProfile();
  const weapon = weaponById(weaponId);
  const mode = profile.attackModes[weaponId] || { crit:false, adv:"-" };
  const data = weaponAttackData(profile, weapon);
  const attack = rollD20(profile.resources.steadyAimActive ? "adv" : mode.adv);
  const toHit = attack.chosen + data.attackBonus;
  const damage = rollDice(weapon.damage);
  const critFloor = profile.resources.hexbladeCurseActive ? 19 : 20;
  const crit = mode.crit || attack.chosen >= critFloor;
  let bonusDamage = data.damageBonus + (profile.resources.hexbladeCurseActive ? profBonus(profile) : 0);
  let extra = "";
  let total = damage.total + bonusDamage + (crit ? damage.max : 0);
  if (profile.resources.sneakAttackReady && (classCounts(profile).rogue || 0) > 0 && (weapon.type === "ranged" || weapon.finesse)){
    const sneak = rollDice(sneakAttackDice(profile));
    const sneakTotal = sneak.total + (crit ? sneak.max : 0);
    total += sneakTotal;
    extra = `\nSneak Attack: ${sneak.rolls.join(" + ")}${crit ? ` + crit(${sneak.max})` : ""} = ${sneakTotal}`;
    profile.resources.sneakAttackReady = false;
  }
  const text = [
    `${weapon.name}`,
    `Attack: ${attack.second ? `${attack.first}, ${attack.second}` : attack.first} -> ${attack.chosen} ${fmtMod(data.attackBonus)} = ${toHit}`,
    `Damage: ${damage.rolls.join(" + ")}${bonusDamage ? ` ${fmtMod(bonusDamage)}` : ""}${crit ? ` + crit(${damage.max})` : ""} = ${damage.total + bonusDamage + (crit ? damage.max : 0)} ${weapon.damageType || weapon.type || ""}${extra}\nTotal Damage: ${total}`
  ].join("\n");
  openResult(weapon.name, text);
  pushHistory(text.replace(/\n/g, " | "));
  profile.resources.steadyAimActive = false;
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
    text += `\nSpell attack: ${attack.second ? `${attack.first}, ${attack.second}` : attack.first} -> ${attack.chosen} ${fmtMod(spellAttackMod(profile))} = ${toHit}`;
  } else if (actionType === "save"){
    text += `\nSave DC ${spellDc(profile)}`;
  }
  const damageMatch = String(spell.description || "").match(/take(?:s)? (\d+d\d+) ([A-Za-z]+) damage/i);
  if (damageMatch){
    const damage = rollDice(damageMatch[1]);
    text += `\nDamage: ${damage.rolls.join(" + ")} = ${damage.total} ${damageMatch[2]}`;
  }
  if (/concentration/i.test(String(spell.duration || ""))){
    profile.concentrationActive = spell.name;
    text += `\nConcentration started: ${spell.name}`;
  }
  openResult(spell.name, text);
  pushHistory(text.replace(/\n/g, " | "));
  saveState();
}

function rollInitiative(){
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + profileInitiative(activeProfile());
  openResult("Initiative", `d20 ${roll}\nModifier ${fmtMod(profileInitiative(activeProfile()))}\nTotal ${total}`);
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
  if (profile.resources.channelDivinityUsed >= 1){
    openResult("Channel Divinity", "No uses remaining until a short or long rest.");
    return;
  }
  profile.resources.channelDivinityUsed += 1;
  openResult("Channel Divinity", "Use your chosen Channel Divinity option.");
  pushHistory("Channel Divinity used.");
  saveState();
}

function useWarPriest(){
  const profile = activeProfile();
  const uses = Math.max(1, abilityMod(finalAbilityScores(profile).WIS));
  if (profile.resources.warPriestUsed >= uses){
    openResult("War Priest", "No uses remaining until a long rest.");
    return;
  }
  profile.resources.warPriestUsed += 1;
  openResult("War Priest", "Make one weapon attack as a bonus action.");
  pushHistory("War Priest used.");
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
  pushHistory(profile.resources.steadyAimActive ? "Steady Aim active for next attack." : "Steady Aim cleared.");
  saveState();
}

function toggleSneakAttack(){
  const profile = activeProfile();
  profile.resources.sneakAttackReady = !profile.resources.sneakAttackReady;
  pushHistory(profile.resources.sneakAttackReady ? "Sneak Attack primed." : "Sneak Attack cleared.");
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
  profile.resources.channelDivinityUsed = 0;
  profile.resources.hexbladeCurseUsed = 0;
  profile.resources.hexbladeCurseActive = false;
  profile.resources.bladesongActive = false;
  profile.resources.steadyAimActive = false;
  profile.resources.sneakAttackReady = false;
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
  profile.concentrationActive = "";
  Object.entries(profileHitDice(profile)).forEach(([die, max]) => {
    profile.hitDiceCur[die] = Math.min(max, (profile.hitDiceCur[die] || 0) + Math.max(1, Math.floor(max / 2)));
  });
  pushHistory("Long rest: HP, slots, and long-rest resources refreshed.");
  saveState();
}

function openSpellSelector(){
  const profile = activeProfile();
  const known = new Set(profile.knownSpells || []);
  const prepared = new Set(profile.preparedSpells || []);
  const items = spellItemsForProfile(profile);
  openModal(`
    <div class="modal-head">
      <div class="modal-title">Edit Spells</div>
      <button class="small-btn" data-close>Close</button>
    </div>
    <div class="form-grid">
      <div class="search-wrap">
        <input type="text" id="spellSearchInput" placeholder="Search spells">
        <button class="small-btn" id="spellSearchClear">X</button>
      </div>
      <div class="list-grid" id="spellSelectList"></div>
    </div>
    <div class="modal-actions">
      <button class="action-btn blue" id="saveSpellSelectionBtn">Save</button>
    </div>
  `);
  const renderList = query => {
    const filtered = items.filter(item => item.search.includes(query));
    document.getElementById("spellSelectList").innerHTML = filtered.map(item => `
      <div class="check-item">
        <button class="icon-btn" data-spell-info="${escapeAttr(item.slug)}">i</button>
        <div class="list-item-main">
          <div class="list-title">${escapeHtml(item.name)}</div>
          <div class="list-meta">${escapeHtml(item.meta)}</div>
        </div>
        <label class="class-pick"><span>K</span><input type="checkbox" data-known-choice="${escapeAttr(item.slug)}"${known.has(item.slug) ? " checked" : ""}></label>
        <label class="class-pick"><span>P</span><input type="checkbox" data-prepared-choice="${escapeAttr(item.slug)}"${prepared.has(item.slug) ? " checked" : ""}></label>
        <div></div>
      </div>
    `).join("") || `<div class="empty">No spells found.</div>`;
    document.querySelectorAll("[data-spell-info]").forEach(button => {
      button.onclick = () => {
        const spell = getSpellByName(button.dataset.spellInfo);
        if (spell) openResult(spell.name, `${spell.description}\n\nRange: ${spell.range}\nCasting: ${spell.casting_time}\nDuration: ${spell.duration}`);
      };
    });
  };
  renderList("");
  document.getElementById("spellSearchInput").oninput = event => renderList(event.target.value.trim().toLowerCase());
  document.getElementById("spellSearchClear").onclick = () => {
    document.getElementById("spellSearchInput").value = "";
    renderList("");
  };
  document.getElementById("saveSpellSelectionBtn").onclick = () => {
    profile.knownSpells = Array.from(document.querySelectorAll("[data-known-choice]:checked")).map(input => input.dataset.knownChoice);
    profile.preparedSpells = Array.from(document.querySelectorAll("[data-prepared-choice]:checked")).map(input => input.dataset.preparedChoice);
    profile.preparedSpells.forEach(name => {
      if (!profile.knownSpells.includes(name)) profile.knownSpells.push(name);
    });
    closeModal();
    saveState();
  };
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
    app:"dnd5e-character-builder",
    version:2,
    exportedAt:new Date().toISOString(),
    data:{
      version:2,
      activePage:"builder",
      currentProfileId:profile.id,
      profiles:{ [profile.id]:profile },
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
    state = JSON.parse(event.newValue);
    Object.values(state.profiles).forEach(ensureProfileShape);
    render();
  }catch{}
});

document.getElementById("modalBack").onclick = event => {
  if (event.target.id === "modalBack") closeModal();
};

async function init(){
  await loadDb();
  state = loadState();
  Object.values(state.profiles).forEach(ensureProfileShape);
  await pullActiveProfile();
  render();
}

init().catch(error => {
  document.body.innerHTML = `<pre style="padding:16px;color:white;">${escapeHtml(error?.stack || String(error))}</pre>`;
});
