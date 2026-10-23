import React from 'react';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Compass, ArrowLeft, LayoutDashboard } from 'lucide-react';
import { PRODUCT_NAME } from '../config';

interface NotFoundPageProps {
  onNavigate: (route: string) => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <Card padding="lg" className="max-w-md w-full text-center space-y-4">
        <div className="w-12 h-12 rounded-[8px] bg-sage text-forest-dark flex items-center justify-center mx-auto">
          <Compass className="w-6 h-6 text-forest" />
        </div>

        <div className="space-y-1">
          <span className="font-mono text-xs font-bold text-secondaryText">ERROR 404</span>
          <h2 className="text-xl font-bold font-heading text-primaryText">
            Page Not Found
          </h2>
          <p className="text-xs text-secondaryText leading-relaxed">
            The requested operational route does not exist or has been relocated within {PRODUCT_NAME}.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onNavigate('/dashboard')}
            icon={<LayoutDashboard className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Operational Dashboard
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('/')}
            icon={<ArrowLeft className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Public Site
          </Button>
        </div>
      </Card>
    </div>
  );
};
