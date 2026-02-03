import { createContext } from 'preact/compat';
import { useContext } from 'preact/hooks';

const AuthContext = createContext(false);

export function AuthProvider({ children, value }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
