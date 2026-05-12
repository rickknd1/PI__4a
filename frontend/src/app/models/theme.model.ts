export interface Theme {
    name: string;
    primaryColor: string;
    accentColor: string;
    bubbleColor: string;
    backgroundColor: string;
    isGradient: boolean;
    gradientEndColor: string | null;
    backgroundImageUrl?: string | null;
}