"use server";

// This file is now a barrel file re-exporting actions from the user-management directory.
// Please add new user management related server actions to the appropriate file
// within wedding-pro-app/app/actions/user-management/

import {
    createOrganizationWithAdmin as coa,
    getUserMemberships as gum
} from './actions/user-management/organization-actions';
import {
    inviteManager as im,
    inviteEmployee as ie
    // employeeSelfSignup was moved
} from './actions/user-management/invitation-actions';
import { employeeSelfSignup as ess } from './actions/user-management/employee-self-signup-action';
import {
    updateUserApprovalStatus as uuas,
    getOrganizationUsers as gou,
    getPendingAccountsViaEdgeFunction as gpaef,
    approveAccountViaEdgeFunction as aaef,
    rejectAccountViaEdgeFunction as raef,
    processAccountApprovalViaEdgeFunction as paavef
} from './actions/user-management/approval-actions';
import {
    switchActiveOrganization as sao,
    setActiveOrganizationAndRedirect as saor
} from './actions/user-management/session-actions';

export {
    coa as createOrganizationWithAdmin,
    gum as getUserMemberships,
    im as inviteManager,
    ie as inviteEmployee,
    ess as employeeSelfSignup,
    uuas as updateUserApprovalStatus,
    gou as getOrganizationUsers,
    gpaef as getPendingAccountsViaEdgeFunction,
    aaef as approveAccountViaEdgeFunction,
    raef as rejectAccountViaEdgeFunction,
    paavef as processAccountApprovalViaEdgeFunction,
    sao as switchActiveOrganization,
    saor as setActiveOrganizationAndRedirect
};