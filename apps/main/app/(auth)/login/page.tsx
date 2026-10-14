import { redirect } from "next/navigation"

// Old links and saved bookmarks: the login screen now lives at /.
export default function LoginPage() {
    redirect("/")
}
