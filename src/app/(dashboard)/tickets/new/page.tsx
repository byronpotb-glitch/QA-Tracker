import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/roles";
import { getProjects } from "@/lib/projects";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const projects = await getProjects();

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm projects={projects} />
        </CardContent>
      </Card>
    </div>
  );
}
