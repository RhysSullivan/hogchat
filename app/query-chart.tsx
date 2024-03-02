"use client";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChartType, QueryResult } from "./action";
import { AreaChart, Card } from "@tremor/react";

export function Chart(props: {
  queryResult: QueryResult;
  chartType: ChartType;
  title?: string;
  description?: string;
}) {
  try {
    const { queryResult, chartType } = props;

    if (chartType === "chart") {
      const formatted = queryResult.results.map((row) => {
        const obj: { [key: string]: any } = {};
        queryResult.columns.forEach((col, i) => {
          if (col.toLowerCase() === "date") {
            obj["date"] = row[i];
          } else {
            obj[col] = row[i];
          }
        });
        return obj;
      });

      const cats = queryResult.columns.filter(
        (col) => col.toLowerCase() !== "date"
      );

      return (
        <>
          <span className="text-lg font-medium dark:text-dark-tremor-content-strong">
            {props.title}
          </span>
          <AreaChart categories={cats} index={"date"} data={formatted} />
        </>
      );
    }
    if (chartType == "number") {
      const stat = queryResult.results[0];
      return (
        <div>
          <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
            {props.title}
          </p>
          <div className="mt-2 flex items-baseline space-x-2.5">
            <p className="text-tremor-metric font-semibold text-tremor-content-strong dark:text-dark-tremor-content-strong">
              {stat}
            </p>
          </div>
        </div>
      );
    }
    if (chartType == "table") {
      return (
        <Table>
          <TableCaption>{props.title}</TableCaption>
          <TableHeader>
            <TableRow>
              {queryResult.columns.map((col, i) => (
                <TableCell key={i}>{col}</TableCell>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {queryResult.results.map((row, i) => (
              <TableRow key={i}>
                {row.map((cell, j) => (
                  <TableCell key={j}>{cell}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }
  } catch (error) {
    console.log(error, props);
    return (
      <div className="flex items-center justify-center h-64">
        <Card>
          <p className="text-tremor-default font-medium text-tremor-content dark:text-dark-tremor-content">
            Error rendering chart
          </p>
        </Card>
      </div>
    );
  }
}
