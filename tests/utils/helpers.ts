import { faker } from '@faker-js/faker';
import { UserDetails } from '../data/UserData';

export const helperUrls = {
    api: 'http://localhost:3001/api',
}

export const getFakeUser = (): UserDetails => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    return {
        name: `${firstName} ${lastName}`,
        email: faker.internet.email({ firstName, lastName }),
        role: faker.helpers.arrayElement(['admin', 'editor', 'viewer']),
        avatar: faker.image.avatar(),
    };
};