# Guia de Contribuição — CytoCount

Agradecemos o interesse em contribuir para o **CytoCount**! Este projeto é voltado para bioimagem, bioinformática e microscopia de fluorescência científica.

---

## Como Contribuir

1. **Relato de Bugs & Sugestões**:
   - Abra uma *Issue* no repositório descrevendo o comportamento inesperado, o tipo de imagem microscópica (formato, canais, resolução) e o sistema operacional.
2. **Propostas de Melhoria / Novos Motores**:
   - Para propor novos algoritmos de segmentação ou novos formatos de exportação, descreva a fundamentação matemática/estatística na *Issue* antes de implementar.
3. **Padrões de Código**:
   - **Frontend**: TypeScript estrito com React e componentes modulares.
   - **Backend**: Python 3 com tipagem (`typing`), documentação clara e testes automatizados em `tests/test_api.py`.
   - **Rigor Científico**: A regra de consistência de contagem (`Detectados = Vivas + Mortas + Indeterminadas`) e o cálculo com intervalo de Wilson (95%) não devem ser alterados.

---

## Contato com os Autores

Para colaborações acadêmicas e parcerias institucionais:
- **Gabriel Candido Messias dos Santos** — [gabrielcandidomds@gmail.com](mailto:gabrielcandidomds@gmail.com)
