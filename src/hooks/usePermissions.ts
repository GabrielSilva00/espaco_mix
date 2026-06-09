import { useMemo } from 'react';

export type UserRole = 'client' | 'staff' | 'admin' | 'developer' | null;

interface PermissionContext {
  isApprovedEventCreator?: boolean;
}

interface PermissionsHook {
  role: UserRole;
  can: (action: string, context?: any) => boolean;
  isAtLeast: (minimumRole: NonNullable<UserRole>) => boolean;
}

const ROLE_HIERARCHY: Record<NonNullable<UserRole>, number> = {
  staff: 0,
  client: 1,
  admin: 2,
  developer: 3,
};

export const usePermissions = (currentRole: UserRole, context: PermissionContext = {}): PermissionsHook => {
  return useMemo(() => {
    const isApprovedEventCreator = Boolean(context.isApprovedEventCreator);

    const isAtLeast = (minimumRole: NonNullable<UserRole>) => {
      if (!currentRole) return false;
      return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minimumRole];
    };

    const can = (action: string, context?: any) => {
      if (!currentRole) return false;

      // Developer can bypass everything
      if (currentRole === 'developer') return true;

      switch (action) {
        case 'view_all_events':
          return isAtLeast('admin');
        
        case 'edit_own_events':
          if (isAtLeast('admin')) return true;
          return currentRole === 'client' && isApprovedEventCreator;

        case 'view_own_events_clients':
          return currentRole === 'client' && isApprovedEventCreator;

        case 'view_all_clients':
          return isAtLeast('admin');
        
        case 'view_producers':
          return isAtLeast('admin');
        
        case 'edit_producers':
          return false; // developer handled by bypass
        
        case 'approve_kyc':
          return isAtLeast('admin');

        case 'pause_sales_emergency':
          return isAtLeast('admin') || (currentRole === 'client' && isApprovedEventCreator);

        case 'manage_roles':
          return false; // developer handled by bypass
        
        case 'manage_infrastructure':
        case 'manage_gateways':
        case 'manage_feature_flags':
        case 'view_system_logs':
        case 'impersonate_users':
          return false; // developer handled by bypass
          
        case 'view_audit_logs':
          return isAtLeast('admin');

        default:
          return false;
      }
    };

    return { role: currentRole, can, isAtLeast };
  }, [context.isApprovedEventCreator, currentRole]);
};
