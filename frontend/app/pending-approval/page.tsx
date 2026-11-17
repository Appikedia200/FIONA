import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function PendingApprovalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-8 w-8 text-yellow-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <CardTitle className="text-2xl font-bold">
            Registration Successful!
          </CardTitle>
          <CardDescription>
            Your account is pending admin approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm text-blue-800">
            <p className="font-semibold mb-2">What happens next?</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Admin will review your registration</li>
              <li>You'll receive email notification upon approval</li>
              <li>Once approved, you can login and start using FIONA</li>
            </ul>
          </div>

          <div className="text-center text-sm text-gray-600">
            This usually takes 1-2 business days.
          </div>

          <Link href="/login" className="block">
            <Button variant="ghost" className="w-full">
              Back to Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
