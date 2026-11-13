import { User } from '../../src/domain/User.js';

/**
 * Object Mother: usuários simples e fixos, que raramente mudam entre os testes.
 */
export class UserMother {
    static umUsuarioPadrao() {
        return new User(1, 'Usuario Padrao', 'padrao@email.com', 'PADRAO');
    }

    static umUsuarioPremium() {
        return new User(2, 'Usuario Premium', 'premium@email.com', 'PREMIUM');
    }
}
