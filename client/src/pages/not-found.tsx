import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground mb-2">404 — الصفحة غير موجودة</h1>
          <p className="text-sm text-muted-foreground mb-6">
            الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
          <Link href="/">
            <Button>العودة للرئيسية</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
