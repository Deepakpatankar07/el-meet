"use client";
import { WS_BACKEND_URL } from "@/config";
import NavPage from "@/components/NavPage";
import { Input } from "@/components/buttons/Input";
import AuthGradientBtn from "@/components/buttons/AuthGradientBtn";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { useAppContext } from "@/context/AppContext";

export default function LoginPage() {
  const router = useRouter();
  const { setToken } = useAppContext();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginBtn = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${WS_BACKEND_URL}/api/v1/user/signin`, {
        email,
        password,
      });

      if (res.data.token) {
        setToken(res.data.token);
        toast.success(res.data.message);
        router.push("/");
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
          <div className="flex flex-col gap-1 w-full py-8 mt-8 px-8 border rounded-xl">
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
            <div className="cursor-pointer select-none text-sky-700 flex justify-start">
                <p className="text-sm">Forgot your password?</p>
            </div>

            <div className="pt-4 w-full">
              <AuthGradientBtn
                onClick={handleLoginBtn}
                size="medium"
              >
                {isLoading ? "Logging in..." : "Login"}
              </AuthGradientBtn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}













