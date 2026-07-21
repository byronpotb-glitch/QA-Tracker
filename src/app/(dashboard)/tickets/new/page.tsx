import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NewTicketForm } from "./new-ticket-form";

export default function NewTicketPage() {
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
