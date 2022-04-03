import RotateLeftIcon from "@mui/icons-material/RotateLeft";
import { Box, Button, Divider, Paper, Typography } from "@mui/material";
import Image from "next/image";
import React, { useCallback, useState } from "react";

import itemsJson from "../../data/items.json";
import { Item } from "../../scripts/output-types";
import getGoalIngredients from "../getGoalIngredients";
import {
  resetAll,
  craftOneWithStock,
  decrement,
  DepotState,
  increment,
  selectCrafting,
  selectStock,
  setStock,
  toggleCrafting,
} from "../store/depotSlice";
import { selectGoals } from "../store/goalsSlice";
import { useAppDispatch, useAppSelector } from "../store/hooks";

import ItemInfoPopover from "./ItemInfoPopover";
import ItemNeeded from "./ItemNeeded";

const LMD_ITEM_ID = "4001";

const MaterialsNeeded: React.VFC = React.memo(() => {
  const dispatch = useAppDispatch();
  const stock = useAppSelector(selectStock);
  const crafting = useAppSelector(selectCrafting);
  const goals = useAppSelector(selectGoals);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverItemId, setPopoverItemId] = useState<string | null>(null);

  const handleChange = useCallback(
    (itemId: string, newQuantity: number) => {
      dispatch(setStock({ itemId, newQuantity }));
    },
    [dispatch]
  );

  const handleIncrement = useCallback(
    (itemId: string) => {
      dispatch(increment(itemId));
    },
    [dispatch]
  );

  const handleDecrement = useCallback(
    (itemId: string) => {
      dispatch(decrement(itemId));
    },
    [dispatch]
  );

  const handleCraftOne = useCallback(
    (itemId: string) => {
      dispatch(craftOneWithStock(itemId));
    },
    [dispatch]
  );

  const handleCraftingToggle = useCallback(
    (itemId: string) => {
      dispatch(toggleCrafting(itemId));
    },
    [dispatch]
  );

  const handleReset = useCallback(() => {
    dispatch(resetAll());
  }, [dispatch]);

  const handleClick = useCallback((itemId: string) => {
    setPopoverItemId(itemId);
    setPopoverOpen(true);
  }, []);

  const handlePopoverClose = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  const materialsNeeded: DepotState["stock"] = {};
  // 1. populate the ingredients required for each goal
  goals.flatMap(getGoalIngredients).forEach((ingredient) => {
    materialsNeeded[ingredient.id] =
      (materialsNeeded[ingredient.id] ?? 0) + ingredient.quantity;
  });
  // 2. populate number of ingredients required for items being crafted
  const ingredientToCraftedItemsMapping: { [ingredientId: string]: string[] } =
    {};
  Object.values(itemsJson)
    .filter((item) => materialsNeeded[item.id] != null)
    .sort((a, b) => a.tier - b.tier)
    .forEach((item) => {
      const remaining = Math.max(
        materialsNeeded[item.id] - (stock[item.id] ?? 0),
        0
      );
      if (remaining > 0 && crafting[item.id]) {
        const itemBeingCrafted: Item =
          itemsJson[item.id as keyof typeof itemsJson];
        const { ingredients, yield: itemYield } = itemBeingCrafted;
        if (ingredients != null) {
          const multiplier = Math.ceil(remaining / (itemYield ?? 1));
          ingredients.forEach((ingr) => {
            ingredientToCraftedItemsMapping[ingr.id] = [
              ...(ingredientToCraftedItemsMapping[ingr.id] ?? []),
              item.id,
            ];
            materialsNeeded[ingr.id] =
              (materialsNeeded[ingr.id] ?? 0) + ingr.quantity * multiplier;
          });
        }
      }
    });
  // 3. calculate what ingredients can be fulfilled by crafting
  const stockCopy = { ...stock }; // need to hypothetically deduct from stock
  const canCompleteByCrafting: { [itemId: string]: boolean } = {};
  Object.keys(crafting)
    .filter(
      (craftedItemId) =>
        materialsNeeded[craftedItemId] != null &&
        materialsNeeded[craftedItemId] - (stock[craftedItemId] ?? 0) > 0
    )
    .sort(
      (idA, idB) =>
        itemsJson[idA as keyof typeof itemsJson].tier -
        itemsJson[idB as keyof typeof itemsJson].tier
    )
    .forEach((craftedItemId) => {
      const shortage =
        materialsNeeded[craftedItemId] - (stock[craftedItemId] ?? 0);
      const craftedItem: Item =
        itemsJson[craftedItemId as keyof typeof itemsJson];
      const ingredients = craftedItem.ingredients?.filter(
        (ingr) => ingr.id !== LMD_ITEM_ID
      );
      if (ingredients != null) {
        const itemYield = craftedItem.yield ?? 1;
        // numTimesCraftable: max number of times the formula can be executed
        const numTimesCraftable = Math.min(
          ...ingredients.map((ingr) =>
            Math.floor((stockCopy[ingr.id] ?? 0) / ingr.quantity)
          )
        );
        // numTimesToCraft: how many times we'll actually execute the formula
        const numTimesToCraft = Math.min(
          numTimesCraftable,
          Math.ceil(shortage / itemYield)
        );
        // now deduct from crafting supply
        ingredients.forEach((ingr) => {
          stockCopy[ingr.id] = Math.max(
            (stockCopy[ingr.id] ?? 0) - ingr.quantity * numTimesToCraft
          );
        });
        if (shortage - numTimesToCraft <= 0) {
          canCompleteByCrafting[craftedItemId] = true;
        }
        // even if the crafted item can't be completed, update our hypothetical depot counts
        stockCopy[craftedItemId] =
          (stockCopy[craftedItemId] ?? 0) + numTimesToCraft * itemYield;
      }
    });
  Object.keys(ingredientToCraftedItemsMapping).forEach((ingrId) => {
    if ((materialsNeeded[ingrId] ?? 0) - (stockCopy[ingrId] ?? 0) <= 0) {
      canCompleteByCrafting[ingrId] = true;
    }
  });
  const lmdCost = materialsNeeded[LMD_ITEM_ID] ?? 0;
  delete materialsNeeded[LMD_ITEM_ID];

  return (
    <Paper component="section" sx={{ p: 2 }}>
      <Box display="grid" gridTemplateColumns="1fr auto">
        <div>
          <Typography component="h2" variant="h5">
            Materials needed
          </Typography>
          <Divider sx={{ mt: 2, mb: 1, width: "90%" }} />
          <Typography component="span" variant="h6">
            Total cost:
            <Box
              component="span"
              display="inline-flex"
              alignItems="center"
              columnGap={0.5}
              ml={1}
            >
              <b>{lmdCost.toLocaleString()}</b>
              <Image
                src="/arknights/lmd-icon"
                width={26}
                height={18}
                alt="LMD"
              />
            </Box>
          </Typography>
        </div>
        <Button
          onClick={handleReset}
          startIcon={<RotateLeftIcon />}
          sx={{ alignSelf: "start", justifySelf: "end" }}
          variant="outlined"
          color="grey"
        >
          Reset
        </Button>
      </Box>
      <Box
        component="ul"
        sx={{
          display: "grid",
          mt: 2,
          mb: 0,
          mx: 0,
          p: 0,
          columnGap: 2,
          rowGap: 1.5,
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
        }}
      >
        {Object.entries(materialsNeeded)
          .sort(
            ([a], [b]) =>
              itemsJson[a as keyof typeof itemsJson].sortId -
              itemsJson[b as keyof typeof itemsJson].sortId
          )
          .map(([itemId, needed]) => (
            <ItemNeeded
              key={itemId}
              component="li"
              itemId={itemId}
              owned={stock[itemId] ?? 0}
              quantity={needed}
              canCompleteByCrafting={canCompleteByCrafting[itemId]}
              isCrafting={crafting[itemId] ?? false}
              onChange={handleChange}
              onCraftOne={handleCraftOne}
              onDecrement={handleDecrement}
              onIncrement={handleIncrement}
              onCraftingToggle={handleCraftingToggle}
              onClick={handleClick}
            />
          ))}
      </Box>
      <ItemInfoPopover
        itemId={popoverItemId}
        ingredientToCraftedItemsMapping={ingredientToCraftedItemsMapping}
        open={popoverOpen}
        onClose={handlePopoverClose}
      />
    </Paper>
  );
});
MaterialsNeeded.displayName = "MaterialsNeeded";
export default MaterialsNeeded;
