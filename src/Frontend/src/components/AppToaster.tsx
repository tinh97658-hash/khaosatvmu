import {
  CircleCheck,
  CircleX,
  Info,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Toaster } from 'sonner';
import '../styles/toast.css';

export function AppToaster() {
  return (
    <Toaster
      className="app-toaster"
      position="top-right"
      closeButton
      expand
      visibleToasts={4}
      duration={4500}
      gap={8}
      offset={12}
      mobileOffset={8}
      containerAriaLabel="Thông báo hệ thống"
      icons={{
        success: <CircleCheck aria-hidden="true" />,
        info: <Info aria-hidden="true" />,
        warning: <TriangleAlert aria-hidden="true" />,
        error: <CircleX aria-hidden="true" />,
        loading: <LoaderCircle className="app-toast__spinner" aria-hidden="true" />,
        close: <X aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: 'Đóng thông báo',
        classNames: {
          toast: 'app-toast',
          content: 'app-toast__content',
          title: 'app-toast__title',
          description: 'app-toast__description',
          icon: 'app-toast__icon',
          loader: 'app-toast__loader',
          closeButton: 'app-toast__close',
          actionButton: 'app-toast__action',
          cancelButton: 'app-toast__cancel',
          success: 'app-toast--success',
          info: 'app-toast--info',
          warning: 'app-toast--warning',
          error: 'app-toast--error',
          loading: 'app-toast--loading',
          default: 'app-toast--default',
        },
      }}
    />
  );
}
