export interface UserDetails {
    name: string,
    email: string,
    role: 'admin' | 'editor' | 'viewer',
    avatar: string
}

export const userData = {
    urlClient: 'http://localhost:5173/users', 
    mockUser: {
        name: 'Mock User',
        email: 'test@test.com',
        role: 'admin',
        avatar: 'string'
    } satisfies UserDetails
}