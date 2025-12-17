"use client";

import { Disclosure } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import AlertsButton from "./alerts/AlertsButton";
import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { useAppSelector } from "../lib/hooks";
import { isAdmin } from "../lib/slices/authSlice";

const AuthenticationNavigation = dynamic(
  () => import("./authentication/AuthenticationNavigation"),
  { ssr: false },
);

const navigation = [
  { name: "Image to Animal", to: "/image-to-animal" },
  { name: "Locate to Map", to: "/locate-to-map" },
  { name: "Bird Observations", to: "/bird-observations" },
  { name: "Map Search", to: "/map-search" },
  { name: "Analytics", to: "/analytics" },
];

const adminNavigation = [
  { name: "Admin", to: "/admin" },
];

const renderIcon = (open: boolean) => {
  if (!open) {
    return <Bars3Icon className="block h-6 w-6" aria-hidden="true" />;
  } else {
    return <XMarkIcon className="block h-6 w-6" aria-hidden="true" />;
  }
};

const renderNavLinks = (style: string, includeAdmin: boolean) => {
  const links = includeAdmin ? [...navigation, ...adminNavigation] : navigation;
  return links.map((nav) => (
    <Link href={nav.to} key={nav.name} className={style}>
      {nav.name}
    </Link>
  ));
};

export default function Navigation() {
  const [mounted, setMounted] = useState(false);
  const isUserAdmin = useAppSelector((state) => isAdmin(state));

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header>
      <Disclosure as="nav">
        {({ open }) => (
          <>
            <div className="mx-auto max-w-7xl px-2 sm:px-6 lg:px-8">
              <div className="relative flex h-16 justify-between">
                <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
                  {/* Mobile menu button */}
                  <Disclosure.Button className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-rose-500">
                    <span className="sr-only">Open main menu</span>
                    {renderIcon(open)}
                  </Disclosure.Button>
                </div>
                <div className="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
                  <div className="flex flex-shrink-0 items-center">
                    <Link href="/" className="flex flex-shrink-0 items-center">
                      <img
                        className="block h-8 w-auto lg:hidden"
                        src="/logo.png"
                        alt="Animal to Map"
                      />
                      <img
                        className="hidden h-8 w-auto lg:block"
                        src="/logo.png"
                        alt="Animal to Map"
                      />
                    </Link>
                  </div>
                  <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                    {mounted && renderNavLinks(
                      "inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900 hover:text-rose-500",
                      isUserAdmin
                    )}
                  </div>
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">
                  <AlertsButton />
                  <AuthenticationNavigation />
                </div>
              </div>
            </div>
            <Disclosure.Panel className="sm:hidden">
              <div className="space-y-1 pt-2 pb-4">
                {mounted && renderNavLinks(
                  "block hover:border-l-4 hover:border-rose-500 hover:bg-rose-50 py-2 pl-3 pr-4 text-base font-medium text-rose-700",
                  isUserAdmin
                )}
              </div>
            </Disclosure.Panel>
          </>
        )}
      </Disclosure>
    </header>
  );
}
