import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import enCharacterPatchTable from "./GameData/en_US/gamedata/excel/char_patch_table.json" assert { type: "json" };
import enCharacterTable from "./GameData/en_US/gamedata/excel/character_table.json" assert { type: "json" };
import enSkillTable from "./GameData/en_US/gamedata/excel/skill_table.json" assert { type: "json" };
import enUniequipTable from "./GameData/en_US/gamedata/excel/uniequip_table.json" assert { type: "json" };
import cnCharacterPatchTable from "./GameData/zh_CN/gamedata/excel/char_patch_table.json" assert { type: "json" };
import cnCharacterTable from "./GameData/zh_CN/gamedata/excel/character_table.json" assert { type: "json" };
import cnSkillTable from "./GameData/zh_CN/gamedata/excel/skill_table.json" assert { type: "json" };
import cnUniequipTable from "./GameData/zh_CN/gamedata/excel/uniequip_table.json" assert { type: "json" };
import {
  DATA_OUTPUT_DIRECTORY,
  gameDataCostToIngredient,
  getEliteLMDCost,
  getOperatorName,
  professionToClass,
} from "./shared.mjs";

const enPatchCharacters = enCharacterPatchTable.patchChars;
const cnPatchCharacters = cnCharacterPatchTable.patchChars;
const { equipDict: cnEquipDict, charEquip: cnCharEquip } = cnUniequipTable;
const { equipDict: enEquipDict } = enUniequipTable;

const isOperator = (charId) => {
  const operator = cnCharacterTable[charId];
  return (
    operator.profession !== "TOKEN" &&
    operator.profession !== "TRAP" &&
    !operator.isNotObtainable
  );
};

const isSummon = (charId) => {
  const entry = cnCharacterTable[charId];
  return entry.profession === "TOKEN";
};

// see output-types.ts#OperatorGoalCategory
const OperatorGoalCategory = {
  Elite: 0,
  Mastery: 1,
  SkillLevel: 2,
  Module: 3,
};

const createOperatorsJson = () => {
  const operatorsJson = Object.fromEntries(
    [
      ...Object.entries(cnCharacterTable).filter(([opId]) => isOperator(opId)),
      ...Object.entries(cnPatchCharacters),
    ].map(([id, operator]) => {
      const rarity = operator.rarity + 1;
      const isCnOnly =
        enCharacterTable[id] == null && enPatchCharacters[id] == null;
      const isPatchCharacter = cnPatchCharacters[id] != null;

      const skillLevelGoals = isPatchCharacter
        ? []
        : operator.allSkillLvlup
            .filter(({ lvlUpCost }) => lvlUpCost != null)
            .map((skillLevelEntry, i) => {
              const cost = skillLevelEntry.lvlUpCost;
              const ingredients = cost.map(gameDataCostToIngredient);
              return {
                // we want to return the result of a skillup,
                // and since [0] points to skill level 1 -> 2, we add 2
                skillLevel: i + 2,
                ingredients,
                name: `Skill Level ${i + 2}`,
                category: OperatorGoalCategory.SkillLevel,
              };
            });

      const eliteGoals = isPatchCharacter
        ? []
        : operator.phases
            .filter(({ evolveCost }) => evolveCost != null)
            .map(({ evolveCost }, i) => {
              const ingredients = evolveCost.map(gameDataCostToIngredient);
              ingredients.unshift(getEliteLMDCost(rarity, i + 1));
              // [0] points to E1, [1] points to E2, so add 1
              return {
                eliteLevel: i + 1,
                ingredients,
                name: `Elite ${i + 1}`,
                category: OperatorGoalCategory.Elite,
              };
            });

      const skills = operator.skills
        .filter(
          ({ skillId, levelUpCostCond }) =>
            skillId != null &&
            // require that all mastery levels have a levelUpCost defined
            !levelUpCostCond.find(({ levelUpCost }) => levelUpCost == null)
        )
        .map(({ skillId, levelUpCostCond }, i) => {
          const masteries = levelUpCostCond.map(({ levelUpCost }, j) => {
            const ingredients = levelUpCost.map(gameDataCostToIngredient);
            return {
              masteryLevel: j + 1,
              ingredients,
              name: `Skill ${i + 1} Mastery ${j + 1}`,
              category: OperatorGoalCategory.Mastery,
            };
          });

          const skillTable = isCnOnly ? cnSkillTable : enSkillTable;
          return {
            skillId: skillId,
            iconId: skillTable[skillId].iconId,
            skillName: skillTable[skillId].levels[0].name,
            masteries,
          };
        });

      let modules = [];
      if (cnCharEquip[id] != null) {
        cnCharEquip[id].shift();
        modules = cnCharEquip[id].map((modName) => {
          const cnModuleData = cnEquipDict[modName];
          const enModuleData = enEquipDict[modName];
          const typeName =
            cnModuleData.typeName1 + "-" + cnModuleData.typeName2;
          const stages = [...Array(3)].map((_, modLevel) => {
            return {
              moduleLevel: modLevel + 1,
              ingredients: cnModuleData.itemCost[`${modLevel + 1}`].map(
                gameDataCostToIngredient
              ),
              name: `Module ${typeName} Stage ${modLevel + 1}`,
              category: OperatorGoalCategory.Module,
            };
          });
          return {
            moduleName: enModuleData?.uniEquipName ?? cnModuleData.uniEquipName,
            moduleId: cnModuleData.uniEquipId,
            typeName,
            stages,
          };
        });
      }

      const outputOperator = {
        id,
        name: getOperatorName(id),
        rarity,
        class: professionToClass(operator.profession),
        branch: operator.subProfessionId, // TODO
        isCnOnly,
        skillLevels: skillLevelGoals,
        elite: eliteGoals,
        skills,
        modules,
      };
      return [id, outputOperator];
    })
  );

  const operatorsOutPath = path.join(DATA_OUTPUT_DIRECTORY, "operators.json");
  fs.writeFileSync(operatorsOutPath, JSON.stringify(operatorsJson, null, 2));
  console.log(`operators: wrote ${operatorsOutPath}`);

  const opNameToId = Object.fromEntries(
    Object.entries(operatorsJson).map(([id, operator]) => [operator.name, id])
  );
  const nameToIdOutPath = path.join(
    DATA_OUTPUT_DIRECTORY,
    "operator-name-to-id.json"
  );
  fs.writeFileSync(nameToIdOutPath, JSON.stringify(opNameToId, null, 2));
  console.log(`operators: wrote ${nameToIdOutPath}`);
};

export default createOperatorsJson;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createOperatorsJson();
}
