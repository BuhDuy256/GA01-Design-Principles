export const parsePostgresArray = (pgArrayData) => {
    if (!pgArrayData) return [];
    if (Array.isArray(pgArrayData)) return pgArrayData; 
    if (typeof pgArrayData === 'string') {
        return pgArrayData
            .replace(/^\{/, '')
            .replace(/\}$/, '')
            .split(',')
            .filter(url => url.trim() !== '');
    }
    return [];
};