"use client";

import { Menu } from "@base-ui/react/menu";
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";

export const DropdownMenu = Menu.Root;
export const DropdownMenuTrigger = Menu.Trigger;

type DropdownMenuContentProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Popup>,
  "className"
> & {
  align?: ComponentPropsWithoutRef<typeof Menu.Positioner>["align"];
  className?: string;
  sideOffset?: ComponentPropsWithoutRef<typeof Menu.Positioner>["sideOffset"];
};

export const DropdownMenuContent = forwardRef<
  ComponentRef<typeof Menu.Popup>,
  DropdownMenuContentProps
>(({ align = "start", className = "", sideOffset = 6, ...props }, ref) => (
  <Menu.Portal>
    <Menu.Positioner align={align} sideOffset={sideOffset} className="z-50">
      <Menu.Popup
        ref={ref}
        className={`z-50 min-w-52 overflow-hidden rounded-md border border-border bg-surface p-1 text-secondary-foreground shadow-lg ${className}`}
        {...props}
      />
    </Menu.Positioner>
  </Menu.Portal>
));
DropdownMenuContent.displayName = Menu.Popup.displayName;

type DropdownMenuLinkItemProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.LinkItem>,
  "className"
> & { className?: string };

export const DropdownMenuLinkItem = forwardRef<
  ComponentRef<typeof Menu.LinkItem>,
  DropdownMenuLinkItemProps
>(({ className = "", ...props }, ref) => (
  <Menu.LinkItem
    ref={ref}
    className={`relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground ${className}`}
    {...props}
  />
));
DropdownMenuLinkItem.displayName = Menu.LinkItem.displayName;

type DropdownMenuItemProps = Omit<
  ComponentPropsWithoutRef<typeof Menu.Item>,
  "className"
> & { className?: string };

/** Generic menu item, including native submit buttons rendered inside forms. */
export const DropdownMenuItem = forwardRef<
  ComponentRef<typeof Menu.Item>,
  DropdownMenuItemProps
>(({ className = "", ...props }, ref) => (
  <Menu.Item
    ref={ref}
    className={`relative flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-left text-sm outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-foreground ${className}`}
    {...props}
  />
));
DropdownMenuItem.displayName = Menu.Item.displayName;
