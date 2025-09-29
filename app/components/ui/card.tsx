// components/ui/card.tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow",
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: CardProps) {
  return (
    <div className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  );
}

function CardTitle({ className, ...props }: CardProps) {
  return (
    <h3
      className={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: CardProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function CardContent({ className, ...props }: CardProps) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

function CardFooter({ className, ...props }: CardProps) {
  return (
    <div className={cn("flex items-center p-6 pt-0", className)} {...props} />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
};
