"use strict";

// backend/integrations/casuya_bridge/conflicts.js — conflict resolution strategies. Load before index.js.

class ConflictResolver {
    constructor() {}

    async resolveConflict(localData, serverData) {
        if (!localData || !serverData) {
            return serverData || localData;
        }

        if (localData.timestamp > serverData.timestamp) {
            return { action: 'keep_local', data: localData };
        } else if (serverData.timestamp > localData.timestamp) {
            return { action: 'pull_server', data: serverData };
        } else {
            return { action: 'pull_server', data: serverData };
        }
    }

    async detectConflicts(localData, serverData) {
        const conflicts = [];
        
        if (localData && serverData) {
            if (localData.completionPercentage !== serverData.completionPercentage) {
                conflicts.push('completionPercentage');
            }
            
            if (localData.scorePercentage !== serverData.scorePercentage) {
                conflicts.push('scorePercentage');
            }
            
            if (localData.elapsedTime !== serverData.elapsedTime) {
                conflicts.push('elapsedTime');
            }
        }
        
        return conflicts.length > 0 ? conflicts : null;
    }
}