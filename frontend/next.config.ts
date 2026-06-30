import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [
      // Admin paths → real Somali routes
      { source: "/admin/login",   destination: "/maamul-login",  permanent: false },
      { source: "/admin/signup",  destination: "/maamul-signup", permanent: false },
      { source: "/admin",         destination: "/maamul-login",  permanent: false },
      // Common guesses & aliases
      { source: "/admin-login",   destination: "/maamul-login",  permanent: false },
      { source: "/admin-signup",  destination: "/maamul-signup", permanent: false },
      { source: "/maamul",        destination: "/maamul-login",  permanent: false },
    ];
  },
};

export default nextConfig;
