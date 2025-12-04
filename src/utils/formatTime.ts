// frontend/src/utils/formatTime.ts

export const formatHoursToHHMMSS = (totalHours: number): string => {
    const totalSeconds = Math.floor(totalHours * 3600);
    
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (num: number) => num.toString().padStart(2, '0');

    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};