import apiClient from './api';

export interface Settings {
  welcomeBackgroundImage?: string;
  welcomeBackgroundImageName?: string;
}

export const getSettings = async (): Promise<Settings> => {
  const response = await apiClient.get('/api/settings');
  return response.data;
};
