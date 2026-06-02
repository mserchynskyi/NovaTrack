import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, loginWithEmail, registerWithEmail, logout } from './firebase';
import { User, onAuthStateChanged } from 'firebase/auth';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    loginEmail: (email: string, pass: string) => Promise<void>;
    registerEmail: (email: string, pass: string) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    loginEmail: loginWithEmail,
    registerEmail: registerWithEmail,
    logout: logout
});

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ 
            user, 
            loading, 
            loginEmail: loginWithEmail, 
            registerEmail: registerWithEmail, 
            logout 
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
