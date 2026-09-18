import { describe, expect, it } from "vitest";
import {
  chooseDseiFeatureType,
  featureTypesFromCapabilities,
} from "../api/funai-geodata.js";

describe("catálogo geoespacial da Funai", () => {
  it("seleciona a camada poligonal de DSEI mesmo quando o nome técnico muda", () => {
    const xml = `<WFS_Capabilities>
      <FeatureTypeList>
        <FeatureType>
          <Name>Funai:sede_dsei_2026</Name>
          <Title>Localização da Sede do Distrito Sanitário Especial Indígena - DSEI</Title>
        </FeatureType>
        <FeatureType>
          <Name>Funai:atuacao_dsei_2026</Name>
          <Title>Área de Atuação do Distrito Sanitário Especial Indígena - DSEI</Title>
        </FeatureType>
      </FeatureTypeList>
    </WFS_Capabilities>`;

    expect(
      chooseDseiFeatureType(featureTypesFromCapabilities(xml)),
    ).toBe("Funai:atuacao_dsei_2026");
  });

  it("não escolhe a camada de sede quando não existe polígono de atuação", () => {
    const xml = `<WFS_Capabilities>
      <FeatureTypeList>
        <FeatureType>
          <Name>Funai:sede_dsei</Name>
          <Title>Localização da Sede do DSEI</Title>
        </FeatureType>
      </FeatureTypeList>
    </WFS_Capabilities>`;

    expect(chooseDseiFeatureType(featureTypesFromCapabilities(xml))).toBe("");
  });
});
