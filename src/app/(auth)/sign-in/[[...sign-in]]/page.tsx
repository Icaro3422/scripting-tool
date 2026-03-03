import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--bg-base))] px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "rgb(99, 102, 241)",
            colorBackground: "rgb(255, 255, 255)",
            colorText: "rgb(30, 33, 39)",
            colorInputBackground: "rgb(243, 244, 246)",
            borderRadius: "0.625rem",
          },
        }}
      />
    </div>
  );
}
