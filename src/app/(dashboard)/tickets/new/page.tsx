import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/roles";
import { NewTicketForm } from "./new-ticket-form";

export default async function NewTicketPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>New Ticket</CardTitle>
        </CardHeader>
        <CardContent>
          <NewTicketForm />
        </CardContent>
      </Card>
    </div>
  );
}
