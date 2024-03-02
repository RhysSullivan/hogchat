"use client";
import { ChartType, QueryResult } from "./action";
import { AreaChart } from "@tremor/react";

export function Chart(props: {
  queryResult: QueryResult;
  chartType: ChartType;
}) {
  const { queryResult, chartType } = props;

  if (chartType === "chart") {
    /*
        Given format:
        [
            ["2024-02-29", 3239, 3736],
        ]
        Goal format: 
        {
            date: 'Dec 22',
            SemiAnalysis: 3239,
            'The Pragmatic Engineer': 3736,
        },
        */

    const formatted = queryResult.results.map((row) => {
      const obj: { [key: string]: any } = {};
      queryResult.columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    const cats = queryResult.columns.filter((col) => col !== "date");

    console.log(formatted);
    return (
      <AreaChart
        categories={cats}
        index={"date"}
        className="h-80"
        data={formatted}
      />
    );
  }
}
