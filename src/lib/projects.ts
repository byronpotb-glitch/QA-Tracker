import { cache } from "react";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { projects, type ProjectRow } from "@/db/schema";

export const getProjects = cache(async (): Promise<ProjectRow[]> => {
  return db.select().from(projects).orderBy(asc(projects.name));
});
