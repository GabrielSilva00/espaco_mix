import React from 'react';
import { UserRole, usePermissions } from '../hooks/usePermissions';

interface RoleGuardProps {
  allowedRoles: NonNullable<UserRole>[];
  currentRole: UserRole;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireOwnership?: string; // e.g. eventId
  ownerId?: string; // the id of the owner of the resource
  currentUserId?: string;
  isApprovedEventCreator?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ 
  allowedRoles, 
  currentRole, 
  children, 
  fallback = null,
  requireOwnership,
  ownerId,
  currentUserId,
  isApprovedEventCreator = false
}) => {
  const { role } = usePermissions(currentRole, { isApprovedEventCreator });

  if (!role) {
    return <>{fallback}</>;
  }

  // Check generic role requirement
  const hasRole = allowedRoles.includes(role) || (role === 'developer');

  if (!hasRole) {
    return <>{fallback}</>;
  }

  // Check specific ownership if required
  if (requireOwnership && ownerId && currentUserId) {
    if (role === 'client' && ownerId !== currentUserId) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};
