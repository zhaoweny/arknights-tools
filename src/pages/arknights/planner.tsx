import { Grid } from "@mui/material";
import { NextPage } from "next";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Operator } from "../../../scripts/output-types";
import GoalSelect from "../../components/GoalSelect";
import Layout from "../../components/Layout";
import OperatorSearch from "../../components/OperatorSearch";
import { addGoals, PlannerGoal } from "../../store/goalsSlice";
import { useAppDispatch } from "../../store/hooks";
import performLegacyMigration from "../../store/performLegacyMigration";

const MaterialsNeeded = dynamic(
  () => import("../../components/MaterialsNeeded"),
  { ssr: false }
);
const PlannerGoals = dynamic(() => import("../../components/PlannerGoals"), {
  ssr: false,
});

const Planner: NextPage = () => {
  const [operator, setOperator] = useState<Operator | null>(null);
  const dispatch = useAppDispatch();

  const handleGoalsAdded = (newGoals: PlannerGoal[]) => {
    dispatch(addGoals(newGoals));
    setOperator(null);
  };

  useEffect(() => {
    try {
      const version = window.localStorage.getItem("version");
      if (version == null || version === "0") {
        dispatch(performLegacyMigration()).then(() => {
          window.localStorage.setItem("version", "1");
        });
      }
    } catch (e) {
      console.error("Failed to migrate old data", e);
    }
  }, [dispatch]);

  return (
    <Layout page="/planner">
      <Grid container mb={2}>
        <Grid
          item
          xs={12}
          md={4}
          sx={{
            pr: {
              xs: 0,
              md: 1,
            },
          }}
        >
          <OperatorSearch
            value={operator}
            onChange={(newOp) => setOperator(newOp)}
          />
        </Grid>
        <Grid
          item
          xs={12}
          md={8}
          sx={{
            mt: {
              xs: 1,
              md: 0,
            },
          }}
        >
          <GoalSelect operator={operator} onGoalsAdded={handleGoalsAdded} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <MaterialsNeeded />
        </Grid>
        <Grid item xs={12} lg={5}>
          <PlannerGoals />
        </Grid>
      </Grid>
    </Layout>
  );
};
export default Planner;
