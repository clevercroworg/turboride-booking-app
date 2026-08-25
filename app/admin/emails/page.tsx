import { PageHeader } from "@/components/admin/admin-ui"
import { EmailManager } from "@/components/admin/email-manager"
import { getEmailTemplates, MERGE_TAGS } from "@/lib/turboride/email-templates"

export const metadata = { title: "Emails — TurboRide Admin" }

export default async function AdminEmailsPage() {
  const templates = await getEmailTemplates()

  return (
    <div>
      <PageHeader
        title="Email Automation"
        subtitle="Edit the copy for every automated email sent to customers."
      />
      <EmailManager templates={templates} mergeTags={MERGE_TAGS} providerConnected={false} />
    </div>
  )
}
