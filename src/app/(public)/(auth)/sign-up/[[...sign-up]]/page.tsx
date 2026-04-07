import { auth } from "@clerk/nextjs/server";
import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import { getSignedInRedirectPath } from "@/lib/auth/redirect";

export default async function SignUpPage() {
  const { userId } = await auth();

  if (userId) {
    redirect(await getSignedInRedirectPath(userId));
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
