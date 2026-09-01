"use client";

import "./globals.css";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AvisoFlotante from "@/app/components/AvisoFlotante";
import BadgePreciosVencidos from "@/app/components/BadgePreciosVencidos";


