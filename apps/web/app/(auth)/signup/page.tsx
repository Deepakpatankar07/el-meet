"use client";
import { WS_BACKEND_URL } from "@/config";
import NavPage from "@/components/NavPage";
import { Input } from "@/components/buttons/Input";
import AuthGradientBtn from "@/components/buttons/AuthGradientBtn";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginBtn = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${WS_BACKEND_URL}/api/v1/user/signup`, {
        name,
        email,
        password,
      });

      if (res.data.user.email === email) {
        toast.success(res.data.message);
        router.push("/login");
      }
    } catch (error) {
        console.warn(error)
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <NavPage />
      <div className="bg-zinc-800/20 backdrop-blur-sm py-[43px] w-full"/>
      <div className="flex justify-center">
        <div className="flex max-w-[400px] w-full">
          <div className="flex flex-col gap-1 w-full py-8 mt-4 px-8 border rounded-xl">
            <Input
              onChange={(e) => setName(e.target.value)}
              label={"Name"}
              type="text"
              placeholder="Enter name"
            />
            <Input
              onChange={(e) => setEmail(e.target.value)}
              label={"Email"}
              type="text"
              placeholder="Enter email"
            />
            <Input
              onChange={(e) => setPassword(e.target.value)}
              label={"Password"}
              type="password"
              placeholder="Enter password"
            />
            <div className="cursor-pointer select-none flex justify-end">
              <p onClick={() => router.push("/login")} className="text-sm text-white/30">Already have an account? <span className="text-blue-500">Log in</span></p>
            </div>

            <div className="pt-4 w-full">
              <AuthGradientBtn
                onClick={handleLoginBtn}
                size="medium"
              >
                {isLoading ? "Processing..." : "Sign Up"}
              </AuthGradientBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}













