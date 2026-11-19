import SwiftUI

enum Terms {
    static let version = 2

    static let sections: [(String, String)] = [
        ("1. O que é o Raptor Player",
         "O Raptor Player é apenas um tocador de vídeo (media player). Não fornecemos, hospedamos, distribuímos, vendemos, transmitimos nem indicamos canais, filmes, séries ou qualquer outro conteúdo."),
        ("2. Origem do conteúdo",
         "Todo o conteúdo exibido vem de vídeos, links ou servidores informados exclusivamente pelo usuário. Não temos vínculo, parceria ou responsabilidade sobre esses provedores ou sobre o material que eles oferecem."),
        ("3. Responsabilidade do usuário",
         "O usuário declara que possui as autorizações, assinaturas e licenças necessárias para reproduzir o conteúdo que cadastra, sendo o único responsável por ele e pelo uso que faz do aplicativo."),
        ("4. Isenção de responsabilidade",
         "Não nos responsabilizamos por conteúdo ilegal, violação de direitos autorais, indisponibilidade, qualidade, cobranças, bloqueios ou qualquer dano decorrente do uso de vídeos e links de terceiros."),
        ("5. Privacidade",
         "Seus acessos e credenciais ficam salvos neste aparelho. Quando você usa a ativação pelo site, esses dados também ficam guardados no servidor de ativação apenas para configurar o aplicativo. Não vendemos, não compartilhamos e não temos acesso ao que você assiste."),
        ("6. Ativação pelo site",
         "A ativação é feita pelo código exibido no aparelho. O código identifica apenas o aparelho para entregar a configuração que você mesmo informou. Você pode substituir a configuração a qualquer momento ativando novamente o mesmo código."),
        ("7. Aceite",
         "Ao tocar em “Aceitar e continuar”, você confirma que leu e concorda com estes termos e assume total responsabilidade pelo uso do aplicativo e pelo conteúdo que nele reproduzir.")
    ]

    static var plainText: String {
        sections.map { "\($0.0)\n\($0.1)" }.joined(separator: "\n\n")
    }
}

struct TermsScreen: View {
    let onAccept: () -> Void

    @State private var showDeclineAlert = false

    var body: some View {
        VStack(spacing: 10) {
            BrandHeader(subtitle: "VIDEO PLAYER")
                .padding(.top, 8)

            Text("TERMO DE USO E AVISO DE RESPONSABILIDADE")
                .font(.caption.weight(.bold))
                .multilineTextAlignment(.center)
                .foregroundStyle(RaptorColor.text)

            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    ForEach(Terms.sections, id: \.0) { title, body in
                        VStack(alignment: .leading, spacing: 3) {
                            Text(title)
                                .font(.subheadline.weight(.bold))
                                .foregroundStyle(RaptorColor.green)
                            Text(body)
                                .font(.footnote)
                                .foregroundStyle(RaptorColor.dim)
                        }
                    }
                    HStack(alignment: .top, spacing: 8) {
                        Image(systemName: "info.circle")
                            .foregroundStyle(RaptorColor.green)
                        Text("Este aplicativo não fornece conteúdo. É apenas um player de vídeo.")
                            .font(.caption)
                            .foregroundStyle(RaptorColor.text)
                    }
                    .padding(12)
                    .background(RaptorColor.green.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
                .padding(16)
            }
            .background(RaptorColor.surface.opacity(0.95))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(RaptorColor.outline, lineWidth: 1))

            HStack(spacing: 12) {
                Button("Não aceito") { showDeclineAlert = true }
                    .font(.subheadline)
                    .foregroundStyle(RaptorColor.dim)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
                    .background(RaptorColor.surfaceHigh)
                    .clipShape(RoundedRectangle(cornerRadius: 12))

                Button(action: onAccept) {
                    Text("Aceitar e continuar")
                        .font(.subheadline.weight(.bold))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 13)
                        .background(RaptorColor.green)
                        .foregroundStyle(RaptorColor.black)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }

            Text("Se não concordar com os termos, não use o aplicativo.")
                .font(.caption2)
                .foregroundStyle(RaptorColor.dim)
                .multilineTextAlignment(.center)
        }
        .padding(20)
        .raptorScreen()
        .alert("Sem aceite", isPresented: $showDeclineAlert) {
            Button("Entendi", role: .cancel) {}
        } message: {
            Text("O Raptor é apenas um player. É necessário aceitar os termos para continuar.")
        }
    }
}
