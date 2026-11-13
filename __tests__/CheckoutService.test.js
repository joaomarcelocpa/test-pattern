import { CheckoutService } from '../src/services/CheckoutService.js';
import { Item } from '../src/domain/Item.js';
import { Pedido } from '../src/domain/Pedido.js';
import { UserMother } from './builders/UserMother.js';
import { CarrinhoBuilder } from './builders/CarrinhoBuilder.js';

describe('CheckoutService', () => {
    const cartao = { numero: '4111111111111111' };

    describe('quando o pagamento falha', () => {
        it('deve retornar null (verificação de estado)', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            // Stub: a única função dele é devolver uma resposta pré-definida
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            // Dummies: apenas preenchem o construtor, nunca são verificados
            const repositoryDummy = {};
            const emailDummy = {};
            const checkoutService = new CheckoutService(gatewayStub, repositoryDummy, emailDummy);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert (verificação de estado)
            expect(pedido).toBeNull();
        });

        it('não deve salvar o pedido nem enviar e-mail (verificação de comportamento)', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder().build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: false }) };
            // Aqui Repository e EmailService são Mocks: o que importa é que NÃO foram chamados
            const repositoryMock = { salvar: jest.fn() };
            const emailMock = { enviarEmail: jest.fn() };
            const checkoutService = new CheckoutService(gatewayStub, repositoryMock, emailMock);

            // Act
            await checkoutService.processarPedido(carrinho, cartao);

            // Assert
            expect(repositoryMock.salvar).not.toHaveBeenCalled();
            expect(emailMock.enviarEmail).not.toHaveBeenCalled();
        });
    });

    describe('quando um cliente padrão finaliza a compra', () => {
        it('deve retornar o pedido salvo com o totalFinal sem desconto', async () => {
            // Arrange
            const carrinho = new CarrinhoBuilder()
                .comUser(UserMother.umUsuarioPadrao())
                .comItens([new Item('Livro', 80), new Item('Caneta', 20)])
                .build();
            const gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            // Stub que "salva" devolvendo o pedido montado pelo service, com um id
            const repositoryStub = {
                salvar: jest.fn(async (p) => new Pedido(1, p.carrinho, p.totalFinal, p.status)),
            };
            const emailDummy = { enviarEmail: jest.fn().mockResolvedValue() };
            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailDummy);

            // Act
            const pedido = await checkoutService.processarPedido(carrinho, cartao);

            // Assert (verificação de estado)
            expect(pedido.carrinho).toBe(carrinho);
            expect(pedido.totalFinal).toBe(100);
            expect(pedido.status).toBe('PROCESSADO');
        });
    });

    describe('quando um cliente Premium finaliza a compra', () => {
        let gatewayStub;
        let repositoryStub;
        let emailMock;
        let pedidoSalvo;
        let pedido;

        beforeEach(async () => {
            // Arrange
            const premium = UserMother.umUsuarioPremium();
            const carrinho = new CarrinhoBuilder()
                .comUser(premium)
                .comItens([new Item('Teclado', 120), new Item('Mouse', 80)]) // R$ 200,00
                .build();
            pedidoSalvo = new Pedido(42, carrinho, 180, 'PROCESSADO');

            // Stubs: controlam o fluxo
            gatewayStub = { cobrar: jest.fn().mockResolvedValue({ success: true }) };
            repositoryStub = { salvar: jest.fn().mockResolvedValue(pedidoSalvo) };
            // Mock: verificamos como foi chamado
            emailMock = { enviarEmail: jest.fn().mockResolvedValue() };

            const checkoutService = new CheckoutService(gatewayStub, repositoryStub, emailMock);

            // Act
            pedido = await checkoutService.processarPedido(carrinho, cartao);
        });

        it('deve cobrar o valor com 10% de desconto', () => {
            // Assert (verificação de comportamento)
            expect(gatewayStub.cobrar).toHaveBeenCalledWith(180, cartao);
        });

        it('deve enviar 1 e-mail de aprovação com os dados corretos', () => {
            // Assert (verificação de comportamento)
            expect(emailMock.enviarEmail).toHaveBeenCalledTimes(1);
            expect(emailMock.enviarEmail).toHaveBeenCalledWith(
                'premium@email.com',
                'Seu Pedido foi Aprovado!',
                'Pedido 42 no valor de R$180'
            );
        });

        it('deve retornar o pedido salvo', () => {
            expect(pedido).toBe(pedidoSalvo);
        });
    });
});
