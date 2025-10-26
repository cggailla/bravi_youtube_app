"use client";

import { createClient } from "@/lib/supabase/client";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type LogoutButtonProps = {
  label?: string;
} & Pick<ButtonProps, "variant" | "size" | "className">;

export function LogoutButton({
  label = "Logout",
  variant = "default",
  size = "sm",
  className,
}: LogoutButtonProps) {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <Button onClick={logout} variant={variant} size={size} className={className}>
      {label}
    </Button>
  );
}
